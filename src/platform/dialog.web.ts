import type { AlertButton } from 'react-native';
export const Alert = { alert(title: string, message?: string, buttons?: AlertButton[]) { const text = title + (message ? '\n'+message : ''); if (buttons?.length) { if (window.confirm(text)) (buttons.find(b => b.style === 'destructive') ?? buttons.find(b => b.style !== 'cancel'))?.onPress?.(); } else window.alert(text); } };
