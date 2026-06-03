// Rode UMA VEZ para criar a tabela de sessão no Supabase: node setup.js
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

console.log('🔧 Verificando tabela de sessão no Supabase...')

// Tenta inserir um registro de teste — se a tabela não existir, vai dar erro específico
const { error } = await supabase.from('whatsapp_session').select('key').limit(1)

if (error?.code === '42P01') {
  console.log('❌ Tabela não existe ainda.')
  console.log('\n📋 Abra o Supabase → SQL Editor e rode:\n')
  console.log('  create table whatsapp_session (')
  console.log('    key   text primary key,')
  console.log('    value text not null')
  console.log('  );')
  console.log('  alter table whatsapp_session disable row level security;')
  console.log('\n  Depois rode este script novamente.')
  process.exit(1)
} else if (error) {
  console.error('❌ Erro ao conectar no Supabase:', error.message)
  process.exit(1)
} else {
  console.log('✅ Supabase conectado e tabela OK!')
  console.log('✅ URL:', process.env.SUPABASE_URL)
  console.log('\n👉 Próximo passo: node connect.js  (para escanear o QR code)')
}
