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
      db.get('SELECT * FROM guild_settings WHERE guild_id=?', [guildId], (err, row) => {
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
              welcome_channel_id: row.welcome_channel_id,
              leave_channel_id: row.leave_channel_id,
              qotd_channel_id: row.qotd_channel_id,
              report_log_channel_id: row.report_log_channel_id,
              moderation_enabled: Boolean(row.moderation_enabled),
              ai_enabled: Boolean(row.ai_enabled),
            }
          })
        } else {
          // Create default settings if not exists
          db.run('INSERT INTO guild_settings (guild_id) VALUES (?)', [guildId], function (err) {
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
                welcome_channel_id: null,
                leave_channel_id: null,
                qotd_channel_id: null,
                report_log_channel_id: null,
                moderation_enabled: true,
                ai_enabled: true,
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
