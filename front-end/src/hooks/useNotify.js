import { App } from 'antd';

// Simple wrapper to avoid importing App.useApp() in every component
export default function useNotify() {
  const { notification, message, modal } = App.useApp();
  return { notification, message, modal };
}
