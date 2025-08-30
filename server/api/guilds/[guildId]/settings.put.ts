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

  const { setting, value } = body

  if (!setting) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Setting name is required'
    })
  }

  try {
    const db = new sqlite3.Database('./guild_settings.db')
    
    return new Promise((resolve, reject) => {
      const sql = `UPDATE guild_settings SET ${setting}=? WHERE guild_id=?`
      db.run(sql, [value, guildId], function (err) {
        if (err) {
          db.close()
          reject(createError({
            statusCode: 500,
            statusMessage: 'Database error'
          }))
          return
        }

        // Return updated settings
        db.get('SELECT * FROM guild_settings WHERE guild_id=?', [guildId], (err2, row) => {
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
              welcome_channel_id: row.welcome_channel_id,
              leave_channel_id: row.leave_channel_id,
              qotd_channel_id: row.qotd_channel_id,
              report_log_channel_id: row.report_log_channel_id,
              moderation_enabled: Boolean(row.moderation_enabled),
              ai_enabled: Boolean(row.ai_enabled),
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
