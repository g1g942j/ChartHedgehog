import type { CollabUser } from '../model/useCollaboration';

interface Props {
    users: CollabUser[];
    connected: boolean;
}

export function CollaborationAvatars({ users, connected }: Props) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
            <div
                title={connected ? 'Совместное редактирование активно' : 'Нет соединения'}
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: connected ? '#4caf50' : '#f44336',
                    flexShrink: 0,
                    transition: 'background 0.3s',
                }}
            />
            {users.map(user => (
                <div
                    key={user.userId}
                    title={user.username}
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: user.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        border: '2px solid var(--surface)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        flexShrink: 0,
                    }}
                >
                    {user.username.charAt(0).toUpperCase()}
                </div>
            ))}
        </div>
    );
}
