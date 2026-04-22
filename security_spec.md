# Security Specification - VeloChat

## 1. Data Invariants
- A user document can only be created/updated by the user themselves.
- A chat can only be created if the requester is one of the `participantIds`.
- A message can only be added to a chat if the sender is one of the `participantIds` of that chat.
- Messages are immutable (no edits/deletes for now to keep it simple and secure).
- Chat metadata (lastMessage, updatedAt) can only be updated when a new message is added or by a participant.

## 2. Dirty Dozen Payloads (Target: DENIED)
1. **Identity Spoofing**: User `A` tries to create/update `/users/B`.
2. **Access Escalation**: User `A` tries to read messages from `/chats/C` where they are NOT in `participantIds`.
3. **Ghost Chat**: User `A` tries to create a chat where they are NOT a participant.
4. **Message Forgery**: User `A` tries to send a message in `/chats/C` as User `B`.
5. **Metadata Poisoning**: User `A` tries to update `updatedAt` to a future/past date (must be `request.time`).
6. **Shadow Fields**: User `A` adds `isAdmin: true` to their user document.
7. **Resource Exhaustion**: Sending a 1MB message (size limit needed).
8. **Broken Hierarchy**: Sending a message to a non-existent chat (relational check).
9. **ID Poisoning**: Using a 2KB string as a `chatId`.
10. **State Corruption**: Deleting another user's message.
11. **PII Leak**: Querying for all users' emails without specific search.
12. **Array Bloat**: Creating a chat with 10,000 participants.

## 3. Test Runner Strategy
We will implement `firestore.rules.test.ts` to verify these patterns.
