export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  related_id?: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  is_read: boolean;
  created_at: string;
}
