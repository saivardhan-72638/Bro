import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";
import MemoryPanel from "../components/MemoryPanel";

import { useChat } from "../hooks/useChat";
import { isVisionModel } from "../services/conversation";
import type { User } from "../services/auth";

interface Props {
  user: User;
  onLogout: () => void;
}

function ChatPage({ user, onLogout }: Props) {
  const {
    messages,
    loading,
    online,
    conversations,
    filteredConversations,
    searchQuery,
    setSearchQuery,
    activeConversationId,
    models,
    model,
    setModel,
    sendMessage,
    regenerate,
    stopGeneration,
    newChat,
    loadConversation,
    removeConversation,
    renameChat,
  } = useChat();

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ??
    "New Conversation";

  const visionAvailable = models.some(isVisionModel);

  function handleNewChat() {
    newChat();
    setSidebarOpen(false);
  }

  function handleConversationSelect(id: number) {
    loadConversation(id);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-dvh bg-[#121110] text-white">
      <Sidebar
        conversations={filteredConversations}
        activeConversationId={activeConversationId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNewChat={handleNewChat}
        onConversationSelect={handleConversationSelect}
        onDeleteConversation={removeConversation}
        onRenameConversation={renameChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail={user.email}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={activeTitle}
          online={online}
          models={models}
          model={model}
          onModelChange={setModel}
          onOpenMemory={() => setMemoryOpen(true)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <ChatWindow
          messages={messages}
          loading={loading}
          onSend={(text) => sendMessage(text)}
          onRegenerate={regenerate}
        />

        <ChatInput
          onSend={(text, attachments) => sendMessage(text, false, attachments)}
          onStop={stopGeneration}
          loading={loading}
          visionAvailable={visionAvailable}
        />
      </div>

      <MemoryPanel
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
      />
    </div>
  );
}

export default ChatPage;