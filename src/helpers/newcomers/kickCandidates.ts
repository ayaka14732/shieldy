import { removeEntryMessages } from '@models/EntryMessage'
import { deleteMessageSafeWithBot } from '@helpers/deleteMessageSafe'
import { bot } from '@helpers/bot'
import { Chat, Candidate } from '@models/Chat'
import { report } from '@helpers/report'
import { addKickedUser } from '@helpers/newcomers/addKickedUser'
import { modifyCandidates } from '@helpers/candidates'
import { modifyRestrictedUsers } from '@helpers/restrictedUsers'

const chatMembersBeingKicked = {} as {
  [index: number]: { [index: number]: boolean }
}

export async function kickCandidates(chat: Chat, candidates: Candidate[]) {
  // Loop through candidates
  for (const candidate of candidates) {
    // Check if they are already being kicked
    if (
      chatMembersBeingKicked[chat.id] &&
      chatMembersBeingKicked[chat.id][candidate.id]
    ) {
      console.log(
        `${candidate.id} in ${chat.id} is already being kicked, skipping`
      )
      continue
    }
    // Try kicking the candidate
    try {
      await addKickedUser(chat, candidate.id)
      kickChatMemberProxy(
        chat.id,
        candidate.id,
        chat.banUsers
      )
    } catch (err) {
      report(err, addKickedUser.name)
    }
    // Try deleting their entry messages
    if (chat.deleteEntryOnKick) {
      removeEntryMessages(candidate.entryChatId, candidate.id)
      deleteMessageSafeWithBot(candidate.entryChatId, candidate.leaveMessageId)
    }
    // Try deleting the captcha message
    deleteMessageSafeWithBot(chat.id, candidate.messageId)
  }
  // Remove from candidates
  await modifyCandidates(chat, false, candidates)
  // Remove from restricted
  await modifyRestrictedUsers(chat, false, candidates)
}

async function kickChatMemberProxy(
  id: number,
  candidateId: number,
  banUsers: boolean
) {
  try {
    if (!chatMembersBeingKicked[id]) {
      chatMembersBeingKicked[id] = {}
    }
    chatMembersBeingKicked[id][candidateId] = true
    if (banUsers) {
      await bot.telegram.kickChatMember(id, candidateId)
    } else {
      await bot.telegram.unbanChatMember(id, candidateId) // kick without ban
    }
  } catch (err) {
    report(err, kickChatMemberProxy.name)
  } finally {
    if (chatMembersBeingKicked[id] && chatMembersBeingKicked[id][candidateId]) {
      delete chatMembersBeingKicked[id][candidateId]
    }
  }
}
