<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div class="card text-center max-w-md w-full">
      <div v-if="loading" class="space-y-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <h2 class="text-xl font-semibold text-gray-900">Authenticating...</h2>
        <p class="text-gray-600">Please wait while we complete your login.</p>
      </div>
      
      <div v-else-if="error" class="space-y-4">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900">Authentication Failed</h2>
        <p class="text-gray-600">{{ error }}</p>
        <button @click="navigateTo('/')" class="btn-primary">
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const { code } = route.query
  
  if (!code) {
    error.value = 'No authorization code received'
    loading.value = false
    return
  }

  try {
    await authStore.handleCallback(code as string)
  } catch (err) {
    error.value = 'Failed to authenticate with Discord'
    loading.value = false
  }
})
</script>
