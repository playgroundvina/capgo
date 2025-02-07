<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { useOrganizationStore } from '~/stores/organization'
import { useDisplayStore } from '~/stores/display'
import { useSupabase } from '~/services/supabase'
import { pickPhoto, takePhoto } from '~/services/photos'

const { t } = useI18n()

const organizationStore = useOrganizationStore()
const displayStore = useDisplayStore()
const supabase = useSupabase()
const isLoading = ref(true)

onMounted(async () => {
  await organizationStore.dedupFetchOrganizations()
  isLoading.value = false
})

const { currentOrganization } = storeToRefs(organizationStore)
const name = computed({
  get: () => currentOrganization.value?.name ?? '',
  set: (val) => {
    if (currentOrganization.value)
      currentOrganization.value.name = val
  },
})
async function presentActionSheet() {
  if (!currentOrganization.value || (!organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner']))) {
    toast.error(t('no-permission'))
    return
  }

  displayStore.showActionSheet = true
  displayStore.actionSheetOption = {
    header: '',
    buttons: [
      {
        text: t('button-camera'),
        handler: () => {
          displayStore.showActionSheet = false
          takePhoto(isLoading, 'org', '')
        },
      },
      {
        text: t('button-browse'),
        handler: () => {
          displayStore.showActionSheet = false
          pickPhoto(isLoading, 'org', '')
        },
      },
      {
        text: t('button-cancel'),
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked')
        },
      },
    ],
  }
}

async function saveChanges() {
  if (!currentOrganization.value || (!organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner']))) {
    toast.error(t('no-permission'))
    return
  }

  const gid = currentOrganization.value.gid

  if (!gid) {
    console.error('No current org id')
    return
  }

  const { error } = await supabase
    .from('orgs')
    .update({ name: name.value })
    .eq('id', gid)

  if (error) {
    // TODO: INFORM USER THAT HE IS NOT ORG OWNER
    console.log(`Cannot save changes: ${error}`)
    return
  }

  toast.success(t('org-changes-saved'))
}

function onInputClick(event: MouseEvent) {
  if (!(organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner']))) {
    toast.error(t('no-permission'))
    event.preventDefault()
  }
}

const acronym = computed(() => {
  let res = 'N/A'
  // use currentOrganization.value?.name first letter of 2 first words or first 2 letter of first word or N/A
  if (currentOrganization.value?.name) {
    const words = currentOrganization.value.name.split(' ')
    if (words.length > 1)
      res = words[0][0] + words[1][0]
    else
      res = words[0].slice(0, 2)
  }
  return res.toUpperCase()
})

function onInputKeyDown(event: Event) {
  if (!(organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner'])))
    event.preventDefault()
}
</script>

<template>
  <div class="h-full p-8 overflow-hidden max-h-fit grow md:pb-0" style="min-height: 100%;">
    <!-- TODO Classes are not working -->
    <FormKit id="update-account" type="form" :actions="false" class="min-h-[100%] flex flex-col justify-between" style="min-height: 100%; display: flex; flex-direction: column;">
      <div>
        <section>
          <div class="flex items-center">
            <div class="mr-4">
              <img
                v-if="currentOrganization?.logo"
                id="org-avatar" class="object-cover w-20 h-20 mask mask-squircle" :src="currentOrganization.logo"
                width="80" height="80" alt="User upload"
              >
              <div v-else class="flex items-center justify-center w-20 h-20 text-4xl border border-black rounded-full dark:border-white">
                <p>{{ acronym }}</p>
              </div>
            </div>
            <button id="change-org-pic" type="button" class="px-3 py-2 text-xs font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" @click="presentActionSheet">
              {{ t('change') }}
            </button>
          </div>
        </section>
        <h2 class="mb-5 text-2xl font-bold text-slate-800 dark:text-white">
          {{ t('general-information') }}
        </h2>
        <div>{{ 'You can modify the organization\'s informations here.' }}</div>
        <div class="mb-6">
          <label for="base-input" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{{ t('organization-name') }}</label>
          <input id="base-input" v-model="name " :readonly="!organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner'])" type="text" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" @click="(event) => onInputClick(event)" @keydown="(event) => onInputKeyDown(event)">
        </div>
      </div>
      <footer style="margin-top: auto">
        <div class="flex flex-col px-6 py-5 border-t border-slate-200">
          <div class="flex self-end">
            <button type="button" class="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700">
              {{ t('cancel') }}
            </button>
            <button
              id="save-changes"
              class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
              type="submit"
              color="secondary"
              shape="round"
              @click.prevent="saveChanges()"
            >
              <span v-if="!isLoading" class="rounded-4xl">
                {{ t('save-changes') }}
              </span>
              <Spinner v-else size="w-8 h-8" class="px-4" color="fill-gray-100 text-gray-200 dark:text-gray-600" />
            </button>
          </div>
        </div>
      </footer>
    </FormKit>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
</route>
