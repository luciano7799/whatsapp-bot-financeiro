// Salva a sessão do Baileys no Supabase em vez de arquivos locais
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys'

const TABLE = 'whatsapp_session'

export async function useSupabaseAuthState(supabase) {
  const readData = async key => {
    const { data } = await supabase.from(TABLE).select('value').eq('key', key).single()
    if (!data) return null
    return JSON.parse(data.value, BufferJSON.reviver)
  }

  const writeData = async (key, value) => {
    const str = JSON.stringify(value, BufferJSON.replacer)
    await supabase.from(TABLE).upsert({ key, value: str }, { onConflict: 'key' })
  }

  const removeData = async key => {
    await supabase.from(TABLE).delete().eq('key', key)
  }

  const creds = (await readData('creds')) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          for (const id of ids) {
            const val = await readData(`${type}-${id}`)
            if (val) data[id] = val
          }
          return data
        },
        set: async items => {
          for (const [type, ids] of Object.entries(items)) {
            for (const [id, value] of Object.entries(ids)) {
              if (value) await writeData(`${type}-${id}`, value)
              else await removeData(`${type}-${id}`)
            }
          }
        },
      },
    },
    saveCreds: () => writeData('creds', creds),
  }
}
