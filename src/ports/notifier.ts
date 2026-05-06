export interface EmailNotifier {
  notifyGroupMembers(groupId: string, message: string): Promise<void>;
}
