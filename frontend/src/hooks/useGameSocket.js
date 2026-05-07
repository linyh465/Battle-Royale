import { useEffect, useRef, useState } from "react";

/**
 * EN: Owns the WebSocket lifecycle. Snapshots write into stateRef.current
 *     (no setState). Non-state messages (welcome / admin_ok / admin_fail / pong)
 *     are surfaced via the optional onMessage callback so consumers can react
 *     without polluting the hook.
 * zh-TW: 管理 WebSocket 生命週期。狀態快照直接寫進 stateRef.current（不走 setState）；
 *         其他訊息（welcome / admin_ok / admin_fail / pong）以 onMessage callback 拋給呼叫方。
 */
export default function useGameSocket({ url, joinPayload, onMessage }) {
  const wsRef = useRef(null);
  const stateRef = useRef(null);
  const onMsgRef = useRef(onMessage);
  useEffect(() => { onMsgRef.current = onMessage; }, [onMessage]);

  const [playerId, setPlayerId] = useState(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      ws.send(JSON.stringify(joinPayload));
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "state") {
        stateRef.current = msg;
      } else if (msg.type === "welcome") {
        setPlayerId(msg.player_id);
      }
      onMsgRef.current?.(msg);
    };

    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("closed");

    return () => { try { ws.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  return { stateRef, playerId, status, send };
}
