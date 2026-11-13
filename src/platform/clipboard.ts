import Clipboard from '@react-native-clipboard/clipboard';
export default { async setString(text: string) { Clipboard.setString(text); }, getString: () => Clipboard.getString() };
