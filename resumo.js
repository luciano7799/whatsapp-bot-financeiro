import { createClient } from '@supabase/supabase-js'
import { getMonth, getYear, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ws from 'ws'

const R$ = v => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export async function gerarResumo() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { realtime: { transport: ws } })
  const { data, error } = await supabase
    .from('transacoes')
    .select('data')
    .eq('user_email', process.env.USER_EMAIL)
    .single()

  if (error || !data) throw new Error('Erro ao buscar dados: ' + error?.message)

  const hoje = new Date()
  const mes  = getMonth(hoje)
  const ano  = getYear(hoje)

  const tx = (data.data || []).filter(t => {
    const d = parseISO(t.date)
    return getMonth(d) === mes && getYear(d) === ano
  })

  const receitas  = tx.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0)
  const despesas  = tx.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0)
  const saldo     = receitas - despesas
  const aPagar    = tx.filter(t => t.type === 'despesa' && !t.pago).reduce((s, t) => s + t.amount, 0)

  // Gastos por categoria
  const porCategoria = {}
  tx.filter(t => t.type === 'despesa').forEach(t => {
    const cat = t.subcategoria || t.category || 'Outros'
    porCategoria[cat] = (porCategoria[cat] || 0) + t.amount
  })
  const topCats = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Gastos por cartão (Inter Luciano / Inter Moni)
  const porCartao = {}
  tx.filter(t => t.type === 'despesa' && t.cartao).forEach(t => {
    const chave = t.classificacao ? `${t.cartao} (${t.classificacao})` : t.cartao
    porCartao[chave] = (porCartao[chave] || 0) + t.amount
  })

  const nomeMes = format(hoje, 'MMMM/yyyy', { locale: ptBR })
    .replace(/^\w/, c => c.toUpperCase())

  let msg = `💰 *Resumo Financeiro — ${nomeMes}*\n\n`
  msg += `📈 Receitas:  ${R$(receitas)}\n`
  msg += `📉 Despesas:  ${R$(despesas)}\n`
  msg += `${saldo >= 0 ? '✅' : '🔴'} Saldo:     ${saldo < 0 ? '-' : ''}${R$(saldo)}\n`
  msg += `⏳ A pagar:   ${R$(aPagar)}\n`

  if (Object.keys(porCartao).length > 0) {
    msg += `\n💳 *Por cartão:*\n`
    Object.entries(porCartao).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      msg += `  • ${k}: ${R$(v)}\n`
    })
  }

  if (topCats.length > 0) {
    msg += `\n📊 *Top categorias:*\n`
    topCats.forEach(([cat, val]) => {
      msg += `  • ${cat}: ${R$(val)}\n`
    })
  }

  msg += `\n_Enviado automaticamente pelo Gestão Financeira_ 🤖`
  return msg
}
