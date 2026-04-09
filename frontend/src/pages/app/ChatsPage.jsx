import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";
import { useAuth } from "../../hooks/useAuth";
import { getRealtimeSocket } from "../../realtime/socket";

function ChatsPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [chatMeta, setChatMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const activeThread = useMemo(
    () => threads.find((t) => t.shared_expense_id === activeId) || null,
    [threads, activeId]
  );

  const chatEnded = Boolean(chatMeta?.chat_ended || activeThread?.chat_ended);

  const loadThreads = async () => {
    const res = await api.get("/chats");
    setThreads(res.data);

    if (!activeId && res.data.length > 0) {
      setActiveId(res.data[0].shared_expense_id);
    }
  };

  const loadMessages = async (sharedExpenseId) => {
    if (!sharedExpenseId) return;

    const res = await api.get(`/chats/${sharedExpenseId}/messages`);
    setChatMeta(res.data.chat);
    setMessages(res.data.messages);
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
    }
  }, [activeId]);

  useEffect(() => {
    const socket = getRealtimeSocket(user?.uid);
    if (!socket) return;

    const onMessage = (payload) => {
      const sharedExpenseId = Number(payload.shared_expense_id);
      loadThreads();
      if (activeId === sharedExpenseId) {
        setMessages((prev) => {
          const incoming = payload.message || {};
          const senderUid = Number(incoming.sender_uid);
          const currentUid = Number(user?.uid);
          const canDelete = Boolean(chatMeta?.is_owner) || senderUid === currentUid;

          return [...prev, { ...incoming, can_delete: canDelete }];
        });
      }
    };

    const onDeleted = (payload) => {
      const sharedExpenseId = Number(payload.shared_expense_id);
      if (activeId !== sharedExpenseId) return;

      setMessages((prev) => prev.map((m) => (
        m.message_id === payload.message_id
          ? { ...m, is_deleted: true, message_content: payload.message_content }
          : m
      )));
      loadThreads();
    };

    const onSharedUpdate = () => {
      loadThreads();
      if (activeId) loadMessages(activeId);
    };

    const onSettlementUpdate = () => {
      loadThreads();
      if (activeId) loadMessages(activeId);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:messageDeleted", onDeleted);
    socket.on("shared:update", onSharedUpdate);
    socket.on("settlement:update", onSettlementUpdate);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:messageDeleted", onDeleted);
      socket.off("shared:update", onSharedUpdate);
      socket.off("settlement:update", onSettlementUpdate);
    };
  }, [user?.uid, activeId, chatMeta?.is_owner]);

  const sendMessage = async () => {
    if (!activeId) return;
    if (chatEnded) return;
    const trimmed = draft.trim();
    if (!trimmed) return;

    try {
      setError("");
      await api.post(`/chats/${activeId}/messages`, { message: trimmed });
      setDraft("");
      loadThreads();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    }
  };

  const removeMessage = async (messageId) => {
    if (!activeId) return;

    try {
      setError("");
      await api.delete(`/chats/${activeId}/messages/${messageId}`);
      await loadMessages(activeId);
      await loadThreads();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete message");
    }
  };

  return (
    <AppLayout title="Shared expense group chats">
      {error ? <div className="panel p-3 mb-4 text-red-300">{error}</div> : null}

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <aside className="panel p-3 max-h-[75vh] overflow-y-auto">
          <h3 className="text-lg mb-3">Chats</h3>
          <div className="space-y-2">
            {threads.map((thread) => (
              <button
                type="button"
                key={thread.shared_expense_id}
                onClick={() => setActiveId(thread.shared_expense_id)}
                className={`w-full text-left p-3 rounded-lg border ${
                  activeId === thread.shared_expense_id
                    ? "border-red-400 bg-zinc-800"
                    : "border-white/10 bg-zinc-900/40"
                }`}
              >
                <div className="font-medium">{thread.title}</div>
                <div className="text-xs text-zinc-400">Owner: {thread.owner_username}</div>
                <div className="text-xs text-zinc-500 truncate mt-1">{thread.last_message || "No messages yet"}</div>
              </button>
            ))}
            {threads.length === 0 ? <p className="text-sm text-zinc-400">No shared expense chats yet.</p> : null}
          </div>
        </aside>

        <section className="panel p-4 flex flex-col min-h-[75vh] max-h-[75vh]">
          <div className="border-b border-white/10 pb-3 mb-3">
            <h3 className="text-lg">{activeThread?.title || "Select a chat"}</h3>
            {chatMeta ? (
              <div>
                <p className="text-sm text-zinc-400">
                  Owner: {chatMeta.owner_username}
                  {chatMeta.is_owner ? <span className="badge ml-2">Admin</span> : null}
                </p>
                {chatEnded ? (
                  <p className="text-sm text-amber-300 mt-1">
                    Chat has ended because there is no pending debt for participants. Previous messages are shown below.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.map((m) => {
              const mine = Number(m.sender_uid) === Number(user?.uid);
              return (
                <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 ${mine ? "bg-red-500/80" : "bg-zinc-800"}`}>
                    <div className="text-xs text-zinc-200 mb-1">{m.sender_username}</div>
                    <div className={`${m.is_deleted ? "italic text-zinc-300" : "text-white"}`}>{m.message_content}</div>
                    <div className="text-[11px] text-zinc-300 mt-1 flex items-center gap-2">
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                      {m.can_delete && !m.is_deleted ? (
                        <button
                          type="button"
                          className="text-red-200 hover:text-white"
                          onClick={() => removeMessage(m.message_id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {activeId && messages.length === 0 ? <p className="text-sm text-zinc-400">No messages yet. Start the chat.</p> : null}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="input"
              placeholder={
                !activeId
                  ? "Select a chat to start messaging"
                  : chatEnded
                    ? "Chat has ended"
                    : "Type message..."
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!activeId || chatEnded}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button className="btn" onClick={sendMessage} disabled={!activeId || chatEnded}>Send</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

export default ChatsPage;
