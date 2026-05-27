import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Topbar } from './Topbar';
import { Sidebar } from '../sidebar/Sidebar';
import { EditorArea } from '../editor/EditorArea';
import { ChatPanel } from '../chat/ChatPanel';
import { Terminal } from '../terminal/Terminal';
import { StatusBar } from './StatusBar';
import { useSettingsStore } from '@/store/settings-store';

interface LayoutProps {
  onOpenSettings?: () => void;
}

export function Layout({ onOpenSettings }: LayoutProps) {
  const { sidebarVisible, chatVisible, terminalVisible } = useSettingsStore();

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
    >
      <Topbar onOpenSettings={onOpenSettings} />

      <div
        className="flex flex-1 overflow-hidden"
        style={{ padding: '10px', gap: '8px' }}
      >
        <PanelGroup direction="horizontal" className="flex-1">
          {sidebarVisible && (
            <>
              <Panel
                defaultSize={18}
                minSize={12}
                maxSize={28}
                id="sidebar"
                className="panel-float"
              >
                <Sidebar />
              </Panel>
              <PanelResizeHandle
                style={{ width: '8px', background: 'transparent', flexShrink: 0 }}
              />
            </>
          )}

          <Panel
            defaultSize={chatVisible ? 52 : 82}
            minSize={30}
            id="editor"
            className="panel-float"
          >
            <PanelGroup direction="vertical">
              <Panel defaultSize={terminalVisible ? 70 : 100} minSize={30} id="editor-main" style={{ overflow: 'hidden' }}>
                <EditorArea />
              </Panel>
              {terminalVisible && (
                <>
                  <PanelResizeHandle
                    style={{ height: '6px', background: 'transparent', cursor: 'row-resize' }}
                  />
                  <Panel
                    defaultSize={30}
                    minSize={15}
                    maxSize={60}
                    id="terminal"
                    style={{ overflow: 'hidden', borderTop: '1px solid hsl(var(--border-strong))' }}
                  >
                    <Terminal />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {chatVisible && (
            <>
              <PanelResizeHandle
                style={{ width: '8px', background: 'transparent', flexShrink: 0 }}
              />
              <Panel
                defaultSize={30}
                minSize={22}
                maxSize={45}
                id="chat"
                className="panel-float"
              >
                <ChatPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar />
    </div>
  );
}
