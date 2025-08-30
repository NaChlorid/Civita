import sqlite3 from 'sqlite3'

export default defineEventHandler(async (event) => {
  const guildId = getRouterParam(event, 'guildId')
  const authHeader = getHeader(event, 'authorization')
  const body = await readBody(event)
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const { added_words, use_default } = body

  try {
    const db = new sqlite3.Database('./guild_settings.db')
    
    return new Promise((resolve, reject) => {
      const sql = 'INSERT OR REPLACE INTO profanity_settings (guild_id, added_words, use_default) VALUES (?, ?, ?)'
      db.run(sql, [guildId, JSON.stringify(added_words || []), use_default ? 1 : 0], function (err) {
        if (err) {
          db.close()
          reject(createError({
            statusCode: 500,
            statusMessage: 'Database error'
          }))
          return
        }

        // Return updated settings
        db.get('SELECT * FROM profanity_settings WHERE guild_id=?', [guildId], (err2, row) => {
          db.close()
          
          if (err2) {
            reject(createError({
              statusCode: 500,
              statusMessage: 'Database error'
            }))
            return
          }

          resolve({
            data: {
              guild_id: row.guild_id,
              added_words: JSON.parse(row.added_words || '[]'),
              use_default: Boolean(row.use_default),
            }
          })
        })
      })
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error'
    })
  }
})
