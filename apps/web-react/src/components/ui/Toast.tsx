type Props = {
  message: string;
  visible: boolean;
};

/** 轻量提示，复用 .toast 视觉 */
export function Toast({ message, visible }: Props) {
  if (!visible || !message) return null;
  return <div className="toast">{message}</div>;
}
