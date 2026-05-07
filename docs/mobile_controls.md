# Mobile Controls — Touch Joystick & Fire Button

---

=== "English"

    ### Layout

    ```
    +----------------------------------------------------+
    |  [Mini-Map]                          [HUD Panel]   |
    |                                                    |
    |                                                    |
    |                                                    |
    |                                                    |
    |                                                    |
    |   ╭───╮                                  ╭─────╮   |
    |   │ ◯ │   ← Joystick (BL)    Fire (BR) → │FIRE │   |
    |   ╰───╯                                  ╰─────╯   |
    +----------------------------------------------------+
    ```

    ### Component breakdown

    | File | Responsibility |
    |---|---|
    | `Joystick.jsx` | Round base + draggable knob. Reports `(dx, dy)` in `[-1, 1]`. |
    | `FireButton.jsx` | Big tap-and-hold button. Reports `true` while pressed. |
    | `MobileControls.jsx` | Touch detection + absolute-positioned overlay container. |
    | `GameCanvas.jsx` | Stores joystick / fire values in `useRef`. The existing 30 Hz input loop forwards them. |

    ### Why DOM overlay (not canvas-drawn)

    - Pointer events on absolute-positioned `<div>`s are simpler and more reliable than hit-testing inside the canvas, especially with multi-touch.
    - The container uses `pointer-events: none` and the controls themselves use `pointer-events: auto`. Result: the joystick and button capture their own touches, but everywhere else (including the canvas) still receives events normally.

    ### How input flows to the server

    ```
    finger drag        Joystick.onPointerMove
                              │
                              ▼  (dx, dy)
                    MobileControls.onJoystick
                              │
                              ▼  joystickRef.current = { x, y }
                      GameCanvas (refs only — no setState)
                              │
                              ▼  every 33 ms (30 Hz)
                     send({ type: "input", dx, dy, angle, fire })
                              │
                              ▼
                           FastAPI engine.apply_input()
    ```

    The exact same payload shape the keyboard/mouse path produces — the server cannot tell desktop from mobile.

    ### Aim on mobile

    There is no second stick. When the joystick is active, **aim follows movement direction** (`angle = atan2(dy, dx)`). When the joystick is released, the last angle is preserved. Add a second joystick or a tap-to-aim gesture if your game design needs decoupled aim.

    ### Touch detection logic

    `MobileControls.shouldShow()`:

    1. `?touch=1` query parameter — force-show on desktop for testing.
    2. `window.matchMedia("(pointer: coarse)").matches` — phones, tablets, touch laptops.
    3. Fallback: `"ontouchstart" in window`.

    Add `?touch=1` to the URL on desktop to verify touch UX without unplugging your mouse.

    ---

    ### Customization guide

    All knobs live in three files, none of them in `GameCanvas.jsx`. The exact same payload contract is preserved no matter how aggressively you restyle.

    #### Resize the joystick

    Pass `size` and `knobSize` from `MobileControls.jsx`:

    ```jsx
    <Joystick size={180} knobSize={80} onChange={onJoystick} />
    ```

    `Joystick.jsx` derives the deadzone radius automatically from `size - knobSize / 2`. The knob is moved with `transform: translate()` (GPU-friendly, no layout).

    #### Reposition the joystick (e.g. higher up the screen)

    In `MobileControls.jsx`:

    ```jsx
    <div style={{ position: "absolute", left: 24, bottom: 24, ... }}>  // default
    <div style={{ position: "absolute", left: 24, bottom: 120, ... }}> // higher
    <div style={{ position: "absolute", left: "50%", bottom: 24,
                  transform: "translateX(-50%)", ... }}>               // bottom-center
    ```

    The `pointerEvents: "auto"` style on this wrapper is required — don't drop it.

    #### Restyle the joystick base / knob

    In `Joystick.jsx`, the inline `style={...}` blocks on the base `<div>` and knob `<div>` are the only place colours, borders, and shadows live. Change `background`, `border`, `boxShadow`, etc. To use an image:

    ```jsx
    style={{
      width: size, height: size, borderRadius: "50%",
      background: "url(/joystick-base.png) center/contain no-repeat",
      border: "none",
      ...
    }}
    ```

    #### Resize / reposition the Fire button

    In `MobileControls.jsx`:

    ```jsx
    <FireButton size={140} onChange={onFire} />          // bigger
    ```

    Position is set on the wrapper `<div>` exactly like the joystick (`right`, `bottom`).

    #### Restyle the Fire button (label, colour, icon)

    `FireButton.jsx` is intentionally tiny. Edit:
    - the inline `style` (`background`, `border`, `fontSize`, `borderRadius`),
    - the inner JSX text (`FIRE` → an `<svg>` icon, an emoji, etc.),
    - the `setPressed()` function inside the effect — it controls the pressed-state visuals (currently a darker red and a `scale(0.94)`).

    #### Multi-touch sanity

    The joystick uses `setPointerCapture(pointerId)` and stores `pointerIdRef`. The fire button does the same. So a player can hold-fire with one finger while dragging the joystick with another — events stay routed to the correct element.

    If you add a third control (e.g. an aim stick), follow the same pattern: capture its own pointer ID and ignore others.

=== "繁體中文"

    ### 版面配置

    ```
    +----------------------------------------------------+
    |  [小地圖]                              [HUD 面板]    |
    |                                                    |
    |                                                    |
    |                                                    |
    |                                                    |
    |                                                    |
    |   ╭───╮                                  ╭─────╮   |
    |   │ ◯ │  ← 搖桿（左下）   射擊鈕（右下） → │FIRE │   |
    |   ╰───╯                                  ╰─────╯   |
    +----------------------------------------------------+
    ```

    ### 元件職責

    | 檔案 | 職責 |
    |---|---|
    | `Joystick.jsx` | 圓形底座 + 可拖曳球。回傳 `[-1, 1]` 的 `(dx, dy)`。 |
    | `FireButton.jsx` | 按住即連射的大按鈕，按住期間回傳 `true`。 |
    | `MobileControls.jsx` | 觸控裝置偵測 + 絕對定位容器。 |
    | `GameCanvas.jsx` | 把搖桿／射擊值寫到 `useRef`，由現有 30 Hz input 迴圈送出。 |

    ### 為什麼用 DOM overlay（而非畫進 Canvas）

    - 在絕對定位的 `<div>` 上掛 pointer events，比在 Canvas 內做命中測試簡單得多，多點觸控尤其可靠。
    - 容器設 `pointer-events: none`，控制元件本身設 `pointer-events: auto`：搖桿與按鈕能正確抓自己的觸控，其他區域（含 Canvas）一切照舊。

    ### 觸控如何送到伺服器

    ```
    手指拖曳            Joystick.onPointerMove
                              │
                              ▼  (dx, dy)
                    MobileControls.onJoystick
                              │
                              ▼  joystickRef.current = { x, y }
                      GameCanvas（只寫 ref，不 setState）
                              │
                              ▼  每 33 ms（30 Hz）
                     send({ type: "input", dx, dy, angle, fire })
                              │
                              ▼
                           FastAPI engine.apply_input()
    ```

    與鍵盤/滑鼠完全相同的 payload — 伺服器無從區別桌機或手機。

    ### 手機的瞄準

    手機沒有第二根搖桿。**搖桿啟動期間，瞄準方向跟著移動方向**（`angle = atan2(dy, dx)`）；放開搖桿後角度保留。如果遊戲設計需要瞄準與移動解耦，再加上第二根搖桿或 tap-to-aim 手勢即可。

    ### 觸控偵測邏輯

    `MobileControls.shouldShow()`：

    1. URL 加 `?touch=1` — 桌機強制顯示，方便測試。
    2. `window.matchMedia("(pointer: coarse)").matches` — 手機、平板、觸控筆電。
    3. 後備：`"ontouchstart" in window`。

    桌機開發時在網址後面加 `?touch=1` 即可不插滑鼠也能驗證觸控 UX。

    ---

    ### 客製化指南

    所有可調項目都在三個檔案內，與 `GameCanvas.jsx` 完全解耦。不管外觀怎麼換，送給後端的 payload 永遠不變。

    #### 調整搖桿大小

    在 `MobileControls.jsx` 傳入 `size` 與 `knobSize`：

    ```jsx
    <Joystick size={180} knobSize={80} onChange={onJoystick} />
    ```

    `Joystick.jsx` 會自動由 `size - knobSize / 2` 推出半徑。搖桿球以 `transform: translate()` 移動，由 GPU 處理，不觸發 layout。

    #### 移動搖桿位置（例如：往上挪）

    於 `MobileControls.jsx`：

    ```jsx
    <div style={{ position: "absolute", left: 24, bottom: 24, ... }}>   // 預設
    <div style={{ position: "absolute", left: 24, bottom: 120, ... }}>  // 上移
    <div style={{ position: "absolute", left: "50%", bottom: 24,
                  transform: "translateX(-50%)", ... }}>                // 下方置中
    ```

    外層 wrapper 的 `pointerEvents: "auto"` 不可拿掉。

    #### 變更搖桿外觀（底座 / 球）

    `Joystick.jsx` 內的兩個 inline `style={...}` 區塊（底座 `<div>` 與搖桿球 `<div>`）就是調整顏色、邊框、陰影的全部位置。可改 `background`、`border`、`boxShadow`，或者改用圖片：

    ```jsx
    style={{
      width: size, height: size, borderRadius: "50%",
      background: "url(/joystick-base.png) center/contain no-repeat",
      border: "none",
      ...
    }}
    ```

    #### 調整射擊鈕大小／位置

    於 `MobileControls.jsx`：

    ```jsx
    <FireButton size={140} onChange={onFire} />          // 加大
    ```

    位置與搖桿同理，由外層 `<div>` 的 `right` / `bottom` 控制。

    #### 客製化射擊鈕（文字、顏色、圖示）

    `FireButton.jsx` 刻意保持輕量，可調的地方有：
    - inline `style`（`background`、`border`、`fontSize`、`borderRadius`）。
    - 內部 JSX 文字（`FIRE` → `<svg>` 圖示或 emoji）。
    - `useEffect` 內的 `setPressed()`：控制按下的視覺（目前為較深的紅 + `scale(0.94)`）。

    #### 多點觸控注意事項

    搖桿與射擊鈕都使用 `setPointerCapture(pointerId)` 並記錄 `pointerIdRef`。所以一根手指按住開火、另一根手指拖搖桿，事件不會互相搶走，會分別送到正確的元件。

    若要再加第三個控制（例如瞄準桿），只要照同樣模式：捕捉自己的 pointer ID、忽略其他即可。
