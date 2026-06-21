import type { CollabCursor } from '../model/useCollaboration';

interface Props {
    cursors: CollabCursor[];
    zoom: number;
    panX: number;
    panY: number;
}

export function RemoteCursors({ cursors, zoom, panX, panY }: Props) {
    if (!cursors.length) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
            {cursors.map(cursor => (
                <div
                    key={cursor.userId}
                    style={{
                        position: 'absolute',
                        left: cursor.x * zoom + panX,
                        top: cursor.y * zoom + panY,
                        pointerEvents: 'none',
                    }}
                >
                    <svg
                        width="16"
                        height="22"
                        viewBox="0 0 16 22"
                        style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
                    >
                        <path
                            d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z"
                            fill={cursor.color}
                            stroke="white"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <div
                        style={{
                            position: 'absolute',
                            top: 18,
                            left: 8,
                            background: cursor.color,
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        }}
                    >
                        {cursor.username}
                    </div>
                </div>
            ))}
        </div>
    );
}
