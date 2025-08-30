<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-bold text-gray-900">Civita Bot Dashboard</h1>
          </div>
          <div class="flex items-center space-x-4">
            <div v-if="authStore.user" class="flex items-center space-x-3">
              <img 
                :src="`https://cdn.discordapp.com/avatars/${authStore.user.id}/${authStore.user.avatar}.png`" 
                :alt="authStore.user.username"
                class="w-8 h-8 rounded-full"
              />
              <span class="text-sm font-medium text-gray-700">{{ authStore.user.username }}</span>
            </div>
            <button @click="authStore.logout()" class="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Guild Selection -->
      <div v-if="!selectedGuild" class="space-y-6">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Select a Server</h2>
          <p class="text-gray-600">Choose a server to manage your bot settings</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            v-for="guild in userGuilds" 
            :key="guild.id"
            @click="selectGuild(guild.id)"
            class="card cursor-pointer hover:shadow-lg transition-shadow duration-200"
          >
            <div class="flex items-center space-x-4">
              <img 
                v-if="guild.icon"
                :src="`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`"
                :alt="guild.name"
                class="w-12 h-12 rounded-lg"
              />
              <div v-else class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <span class="text-gray-500 font-semibold">{{ guild.name.charAt(0) }}</span>
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900">{{ guild.name }}</h3>
                <p class="text-sm text-gray-500">
                  {{ guild.owner ? 'Owner' : 'Member' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dashboard Content -->
      <div v-else class="space-y-6">
        <!-- Guild Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button @click="selectedGuild = null" class="btn-secondary">
              ← Back to Servers
            </button>
            <div class="flex items-center space-x-3">
              <img 
                v-if="currentGuild?.icon"
                :src="`https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`"
                :alt="currentGuild.name"
                class="w-10 h-10 rounded-lg"
              />
              <div v-else class="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                <span class="text-gray-500 font-semibold">{{ currentGuild?.name?.charAt(0) }}</span>
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900">{{ currentGuild?.name }}</h2>
                <p class="text-sm text-gray-500">Bot Management</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="space-y-6">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="card">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Moderation</span>
                    <span :class="botStore.guildSettings?.moderation_enabled ? 'text-green-600' : 'text-red-600'">
                      {{ botStore.guildSettings?.moderation_enabled ? 'Enabled' : 'Disabled' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">AI Replies</span>
                    <span :class="botStore.guildSettings?.ai_enabled ? 'text-green-600' : 'text-red-600'">
                      {{ botStore.guildSettings?.ai_enabled ? 'Enabled' : 'Disabled' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">QOTD Channel</span>
                    <span class="text-gray-900">
                      {{ botStore.guildSettings?.qotd_channel_id ? 'Set' : 'Not Set' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="card">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Profanity Filter</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Mode</span>
                    <span class="text-gray-900">
                      {{ botStore.profanitySettings?.use_default ? 'Default' : 'Custom' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Custom Words</span>
                    <span class="text-gray-900">
                      {{ botStore.profanitySettings?.added_words?.length || 0 }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="card">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                <div class="space-y-3">
                  <button 
                    @click="forceQOTD"
                    class="w-full btn-primary text-sm"
                    :disabled="!botStore.guildSettings?.qotd_channel_id"
                  >
                    Force QOTD
                  </button>
                  <button 
                    @click="refreshData"
                    class="w-full btn-secondary text-sm"
                  >
                    Refresh Data
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Settings Tab -->
          <div v-if="activeTab === 'settings'" class="space-y-6">
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Bot Settings</h3>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium text-gray-700">Moderation</label>
                    <p class="text-sm text-gray-500">Enable automatic profanity filtering</p>
                  </div>
                  <button 
                    @click="toggleSetting('moderation_enabled')"
                    :class="botStore.guildSettings?.moderation_enabled ? 'bg-blue-600' : 'bg-gray-200'"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  >
                    <span 
                      :class="botStore.guildSettings?.moderation_enabled ? 'translate-x-6' : 'translate-x-1'"
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    />
                  </button>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium text-gray-700">AI Replies</label>
                    <p class="text-sm text-gray-500">Enable AI responses when bot is mentioned</p>
                  </div>
                  <button 
                    @click="toggleSetting('ai_enabled')"
                    :class="botStore.guildSettings?.ai_enabled ? 'bg-blue-600' : 'bg-gray-200'"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  >
                    <span 
                      :class="botStore.guildSettings?.ai_enabled ? 'translate-x-6' : 'translate-x-1'"
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Users Tab -->
          <div v-if="activeTab === 'users'" class="space-y-6">
            <div class="card">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">XP Leaderboard</h3>
                <button @click="loadUserXP" class="btn-secondary text-sm">
                  Refresh
                </button>
              </div>
              
              <div v-if="botStore.userXP.length === 0" class="text-center py-8">
                <p class="text-gray-500">No XP data available</p>
              </div>
              
              <div v-else class="space-y-3">
                <div 
                  v-for="(user, index) in botStore.userXP" 
                  :key="user.user_id"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center space-x-3">
                    <span class="text-lg font-bold text-gray-400 w-8">#{{ index + 1 }}</span>
                    <div>
                      <p class="font-medium text-gray-900">User {{ user.user_id }}</p>
                      <p class="text-sm text-gray-500">Level {{ user.level }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-semibold text-gray-900">{{ user.xp }} XP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const authStore = useAuthStore()
const botStore = useBotStore()

const selectedGuild = ref(null)
const activeTab = ref('overview')

const tabs = [
  { id: 'overview', name: 'Overview' },
  { id: 'settings', name: 'Settings' },
  { id: 'users', name: 'Users' },
]

const userGuilds = computed(() => {
  return authStore.user?.guilds?.filter(guild => 
    guild.owner || parseInt(guild.permissions) & 0x8 // Administrator permission
  ) || []
})

const currentGuild = computed(() => {
  return userGuilds.value.find(g => g.id === selectedGuild.value)
})

function selectGuild(guildId) {
  selectedGuild.value = guildId
  botStore.selectGuild(guildId)
}

async function toggleSetting(setting) {
  try {
    await botStore.updateGuildSetting(selectedGuild.value, setting, !botStore.guildSettings[setting])
  } catch (error) {
    console.error('Failed to update setting:', error)
  }
}

async function forceQOTD() {
  try {
    await botStore.forceQOTD(selectedGuild.value)
    // Show success message
  } catch (error) {
    console.error('Failed to force QOTD:', error)
  }
}

async function loadUserXP() {
  await botStore.fetchUserXP(selectedGuild.value)
}

async function refreshData() {
  await botStore.fetchGuildSettings(selectedGuild.value)
  await botStore.fetchProfanitySettings(selectedGuild.value)
  await botStore.fetchUserXP(selectedGuild.value)
}

// Redirect if not authenticated
onMounted(() => {
  if (!authStore.isAuthenticated) {
    navigateTo('/')
  }
})
</script>
