import { useEffect, useRef, useState } from "react";
import expandSnapshot from "./expandSnapshot.js";

/**
 * EN: Owns the WebSocket lifecycle. Snapshots write into stateRef.current
 *     (no setState). Non-state messages (welcome / admin_ok / admin_fail / pong)
 *     are surfaced via the optional onMessage callback so consumers can react
 *     without polluting the hook.
 *     The Phase 9 server emits a minified ('ps' / 'bs' / 'i' / 'h' …) payload
 *     to save Railway egress; expandSnapshot() rehydrates it into the long-key
 *     shape that the rendering components expect.
 * zh-TW: 管理 WebSocket 生命週期。狀態快照直接寫進 stateRef.current（不走 setState）；
 *         其他訊息（welcome / admin_ok / admin_fail / pong）以 onMessage callback 拋給呼叫方。
 *         Phase 9 伺服器送出的是極短鍵格式（'ps' / 'bs' / 'i' / 'h' …）以節省 Railway 出站流量；
 *         expandSnapshot() 會把它展開為渲染元件期望的長鍵結構。
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
        // EN: Expand short wire keys (Phase 9) before exposing to consumers.
        // zh-TW: 將 Phase 9 短鍵格式展開後再交給呼叫端使用。
        msg = expandSnapshot(msg);
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
