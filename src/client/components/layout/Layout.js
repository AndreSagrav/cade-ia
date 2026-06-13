import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Topbar } from './Topbar';
import { Sidebar } from '../sidebar/Sidebar';
import { EditorArea } from '../editor/EditorArea';
import { ChatPanel } from '../chat/ChatPanel';
import { Terminal } from '../terminal/Terminal';
import { StatusBar } from './StatusBar';
import { useSettingsStore } from '@/store/settings-store';
export function Layout({ onOpenSettings }) {
    const { sidebarVisible, chatVisible, terminalVisible } = useSettingsStore();
    return (_jsxs("div", { className: "flex h-screen flex-col overflow-hidden", children: [_jsx(Topbar, { onOpenSettings: onOpenSettings }), _jsx("div", { className: "flex flex-1 overflow-hidden", style: { padding: '10px', gap: '8px' }, children: _jsxs(PanelGroup, { direction: "horizontal", className: "flex-1", children: [sidebarVisible && (_jsxs(_Fragment, { children: [_jsx(Panel, { defaultSize: 18, minSize: 12, maxSize: 28, id: "sidebar", className: "panel-float", children: _jsx(Sidebar, {}) }), _jsx(PanelResizeHandle, { style: { width: '8px', background: 'transparent', flexShrink: 0 } })] })), _jsx(Panel, { defaultSize: chatVisible ? 52 : 82, minSize: 30, id: "editor", className: "panel-float", children: _jsxs(PanelGroup, { direction: "vertical", children: [_jsx(Panel, { defaultSize: terminalVisible ? 70 : 100, minSize: 30, id: "editor-main", style: { overflow: 'hidden' }, children: _jsx(EditorArea, {}) }), terminalVisible && (_jsxs(_Fragment, { children: [_jsx(PanelResizeHandle, { style: { height: '6px', background: 'transparent', cursor: 'row-resize' } }), _jsx(Panel, { defaultSize: 30, minSize: 15, maxSize: 60, id: "terminal", style: { overflow: 'hidden', borderTop: '1px solid hsl(var(--border-strong))' }, children: _jsx(Terminal, {}) })] }))] }) }), chatVisible && (_jsxs(_Fragment, { children: [_jsx(PanelResizeHandle, { style: { width: '8px', background: 'transparent', flexShrink: 0 } }), _jsx(Panel, { defaultSize: 30, minSize: 22, maxSize: 45, id: "chat", className: "panel-float", children: _jsx(ChatPanel, {}) })] }))] }) }), _jsx(StatusBar, {})] }));
}
