<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import Trash from '~icons/heroicons/trash'
import Wrench from '~icons/heroicons/Wrench'

import { useOrganizationStore } from '~/stores/organization'
import type { ExtendedOrganizationMember, ExtendedOrganizationMembers } from '~/stores/organization'
import Plus from '~icons/heroicons/plus'
import type { Database } from '~/types/supabase.types'
import { useDisplayStore } from '~/stores/display'
import { useSupabase } from '~/services/supabase'
import { useMainStore } from '~/stores/main'

const { t } = useI18n()
const displayStore = useDisplayStore()

const organizationStore = useOrganizationStore()
const { currentOrganization } = storeToRefs(organizationStore)
const supabase = useSupabase()
const main = useMainStore()

const members = ref([] as ExtendedOrganizationMembers)

watch(currentOrganization, async () => {
  members.value = await organizationStore.getMembers()
})

onMounted(async () => {
  members.value = await organizationStore.getMembers()
})

// Do not ask me, I don't know how to do it better
// This was stolen from some stack overflow answer
function validateEmail(email: string) {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    )
}

async function showPermModal(invite: boolean): Promise<Database['public']['Enums']['user_min_right'] | undefined> {
  let permision: Database['public']['Enums']['user_min_right'] | undefined
  displayStore.dialogOption = {
    header: t('select-user-perms'),
    message: t('select-user-perms-expanded'),
    buttons: [
      {
        text: t('button-cancel'),
        role: 'cancel',
      },
      {
        text: t('key-read'),
        role: 'read',
        handler: () => permision = invite ? 'invite_read' : 'read',
      },
      {
        text: t('key-upload'),
        role: 'upload',
        handler: () => permision = invite ? 'invite_upload' : 'upload',
      },
      {
        text: t('key-write'),
        role: 'write',
        handler: () => permision = invite ? 'invite_write' : 'write',
      },
      {
        text: t('key-admin'),
        role: 'admin',
        handler: () => permision = invite ? 'invite_admin' : 'admin',
      },
    ],
  }
  displayStore.showDialog = true
  await displayStore.onDialogDismiss()
  return permision
}

async function showInviteModal() {
  if (!currentOrganization.value || (!organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner']))) {
    toast.error(t('no-permission'))
    return
  }

  let permisionPromise: Promise<Database['public']['Enums']['user_min_right'] | undefined> | undefined
  let email: string | undefined

  displayStore.dialogOption = {
    header: t('insert-invite-email'),
    input: true,
    buttons: [
      {
        text: t('button-cancel'),
        role: 'cancel',
      },
      {
        text: t('button-invite'),
        id: 'confirm-button',
        handler: async () => {
          const input = document.getElementById('dialog-input-field') as HTMLInputElement | undefined
          email = input?.value

          if (!email || !input)
            return

          input.value = ''

          if (!validateEmail(email)) {
            toast.error(t('invalid-email'))
            return
          }

          permisionPromise = showPermModal(true)
        },
      },
    ],
  }
  displayStore.showDialog = true
  await displayStore.onDialogDismiss()
  const permision = await permisionPromise

  if (!permision || !email)
    return

  await sendInvitation(email, permision)
}

async function sendInvitation(email: string, type: Database['public']['Enums']['user_min_right']) {
  console.log(`Invite ${email} with perm ${type}`)

  const orgId = currentOrganization.value?.gid
  if (!orgId)
    return

  const { data, error } = await supabase.rpc('invite_user_to_org', {
    email,
    org_id: orgId,
    invite_type: type,
  })

  if (error)
    throw error

  handleSendInvitationOutput(data)
  members.value = await organizationStore.getMembers()
}

function handleSendInvitationOutput(output: string) {
  console.log('Output: ', output)
  switch (output) {
    case 'OK': {
      toast.success(t('org-invited-user'))
      break
    }
    case 'NO_EMAIL': {
      toast.error(t('email-does-not-exist'))
      break
    }
    case 'ALREADY_INVITED': {
      toast.error(t('user-already-invited'))
      break
    }
    case 'CAN_NOT_INVITE_OWNER': {
      toast.error(t('cannot-invite-owner'))
      break
    }
  }
}

async function didCancel() {
  displayStore.dialogOption = {
    header: t('alert-confirm-delete'),
    message: `${t('alert-not-reverse-message')} ${t('alert-delete-message')}?`,
    buttons: [
      {
        text: t('button-cancel'),
        role: 'cancel',
      },
      {
        text: t('button-delete'),
        id: 'confirm-button',
      },
    ],
  }
  displayStore.showDialog = true
  return displayStore.onDialogDismiss()
}

async function deleteMember(member: ExtendedOrganizationMember) {
  if (await didCancel())
    return

  if (member.aid === 0) {
    toast.error(t('cannot-delete-owner'))
    return
  }

  const { error } = await supabase.from('org_users').delete().eq('id', member.aid)
  if (error) {
    console.log('Error delete: ', error)
    toast.error(t('cannot-delete-member'))
  }

  if (member.uid === main.user?.id) {
    organizationStore.fetchOrganizations()
    organizationStore.setCurrentOrganizationToMain()
  }
  else {
    members.value = await organizationStore.getMembers()
  }

  toast.success(t('member-deleted'))
}

async function changeMemberPermission(member: ExtendedOrganizationMember) {
  const perm = await showPermModal(false)

  if (!perm)
    return

  const { error } = await supabase.from('org_users').update({ user_right: perm }).eq('id', member.aid)
  if (error) {
    console.log('Error delete: ', error)
    toast.error(t('cannot-change-permission'))
  }

  toast.success(t('permission-changed'))
}
</script>

<template>
  <div class="h-full p-8 max-h-fit grow md:pb-0 overflow-hidden">
    <div class="flex justify-between w-full">
      <h2 class="mb-5 text-2xl font-bold text-slate-800 dark:text-white">
        {{ t('members') }}
      </h2>
      <button type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center inline-flex items-center mr-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" @click="showInviteModal">
        <Plus />
        {{ t('add-member') }}
      </button>
    </div>
    <div class="flex flex-col overflow-y-auto bg-white shadow-lg border-slate-200 md:mx-auto md:mt-5 md:w-full md:border dark:border-slate-900 md:rounded-lg dark:bg-slate-800">
      <dl class="divide-y divide-gray-500">
        <div v-for="member in members" :key="member.id">
          <div id="member-card" class="flex justify-between mt-2 mb-2 ml-2">
            <div class="flex">
              <img
                v-if="member?.image_url" class="object-cover w-20 h-20 mask mask-squircle" :src="member.image_url"
                width="80" height="80" alt="profile_photo"
              >
              <div v-else class="flex items-center justify-center w-20 h-20 text-4xl border border-black rounded-full dark:border-white">
                <p>{{ 'N/A' }}</p>
              </div>
            </div>
            <div id="user-email" class="mt-auto mb-auto ml-auto mr-auto text-center">
              {{ member.email }}
            </div>
            <div class="mt-auto mb-auto mr-4">
              <button id="wrench-button" :class="`w-7 h-7 bg-transparent ml-4 ${(organizationStore.hasPermisisonsInRole(organizationStore.currentRole, ['admin', 'owner'])) && (member.uid !== currentOrganization?.created_by) ? 'visible' : 'invisible'}`" @click="changeMemberPermission(member)">
                <Wrench class="mr-4 text-lg text-[#397cea]" />
              </button>
              <button id="trash-button" :class="`w-7 h-7 bg-transparent ml-4 ${((member.uid === main.user?.id || currentOrganization?.created_by === main.user?.id || organizationStore.currentRole === 'admin') && member.uid !== currentOrganization?.created_by) ? 'visible' : 'invisible'}`" @click="deleteMember(member)">
                <Trash class="mr-4 text-lg text-red-600" />
              </button>
            </div>
          </div>
        </div>
      </dl>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
</route>
