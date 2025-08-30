import sqlite3 from 'sqlite3'

export default defineEventHandler(async (event) => {
  const guildId = getRouterParam(event, 'guildId')
  const authHeader = getHeader(event, 'authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  try {
    const db = new sqlite3.Database('./guild_settings.db')
    
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM profanity_settings WHERE guild_id=?', [guildId], (err, row) => {
        db.close()
        
        if (err) {
          reject(createError({
            statusCode: 500,
            statusMessage: 'Database error'
          }))
          return
        }

        if (row) {
          resolve({
            data: {
              guild_id: row.guild_id,
              added_words: JSON.parse(row.added_words || '[]'),
              use_default: Boolean(row.use_default),
            }
          })
        } else {
          // Create default settings if not exists
          db.run('INSERT INTO profanity_settings (guild_id) VALUES (?)', [guildId], function (err) {
            if (err) {
              reject(createError({
                statusCode: 500,
                statusMessage: 'Database error'
              }))
              return
            }
            
            resolve({
              data: {
                guild_id: guildId,
                added_words: [],
                use_default: true,
              }
            })
          })
        }
      })
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error'
    })
  }
})
