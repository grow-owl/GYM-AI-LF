import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Check,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  AlertCircle,
  Clock,
  Dumbbell,
  CreditCard,
  Megaphone,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CustomSelect from "@/components/ui/CustomSelect";
import { notificationApi } from "@/lib/endpoints";
import type { INotificationItem, NotificationPaginationMeta } from "@/lib/endpoints";
import { showApiErrorToast } from "@/lib/api";
import { toast } from "sonner";



function getNotificationIcon(type?: string) {
  switch (type?.toUpperCase()) {
    case "PAYMENT":
      return <CreditCard className="w-4 h-4 text-emerald-400" />;
    case "WORKOUT":
      return <Dumbbell className="w-4 h-4 text-sky-400" />;
    case "EXPIRATION":
    case "LEAD":
      return <AlertCircle className="w-4 h-4 text-amber-400" />;
    case "ANNOUNCEMENT":
    case "BROADCAST":
      return <Megaphone className="w-4 h-4 text-indigo-400" />;
    default:
      return <Bell className="w-4 h-4 text-(--color-accent)" />;
  }
}

function formatTimeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateString;
  }
}


export default function Notifications() {
  const [notifications, setNotifications] = useState<INotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "READ">("ALL");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [paginationMeta, setPaginationMeta] = useState<NotificationPaginationMeta>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const isReadParam = filterTab === "UNREAD" ? false : filterTab === "READ" ? true : undefined;
      const res = await notificationApi.list({ page, limit, isRead: isReadParam });
      
      const rawList = res?.notifications || (Array.isArray(res as any) ? (res as any) : []);
      setNotifications(rawList);

      if (res?.pagination) {
        setPaginationMeta(res.pagination);
      } else {
        setPaginationMeta({
          page,
          limit,
          totalItems: rawList.length,
          totalPages: Math.ceil(rawList.length / limit) || 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Failed to load notifications feed";
      setError(msg);
      showApiErrorToast(err, "Failed to load notifications feed");
      setNotifications([]);
      setPaginationMeta({
        page,
        limit,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterTab]);

  useEffect(() => {
    fetchNotifications();

    const handleSync = () => {
      fetchNotifications();
    };

    window.addEventListener("gymai-notifications-updated", handleSync);
    return () => {
      window.removeEventListener("gymai-notifications-updated", handleSync);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    setActionLoading(notificationId);
    try {
      await notificationApi.markAsRead(notificationId);
      toast.success("Notification marked as read");
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId || n.id === notificationId ? { ...n, isRead: true } : n))
      );
      window.dispatchEvent(new CustomEvent("gymai-notifications-updated"));
    } catch {
      toast.error("Failed to mark notification as read");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading("ALL");
    try {
      await notificationApi.markAllAsRead();
      toast.success("All notifications marked as read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent("gymai-notifications-updated"));
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setActionLoading(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications Center"
        subtitle="Stay updated with system alerts, payments, check-ins, and broadcasts"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border) bg-(--color-surface) px-3.5 py-2 text-xs font-medium text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleMarkAllAsRead}
              disabled={actionLoading === "ALL" || unreadCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-white text-xs font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {actionLoading === "ALL" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              Mark all as read
            </button>
          </div>
        }
      />

      {/* Filter Tabs & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--color-border) pb-4">
        <div className="flex items-center gap-2 bg-(--color-surface-2) p-1 rounded-xl border border-(--color-border) self-start">
          <button
            onClick={() => {
              setFilterTab("ALL");
              setPage(1);
            }}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterTab === "ALL"
                ? "bg-(--color-surface) text-(--color-text) shadow-xs font-semibold"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setFilterTab("UNREAD");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterTab === "UNREAD"
                ? "bg-(--color-surface) text-(--color-text) shadow-xs font-semibold"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-(--color-accent) text-[10px] text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setFilterTab("READ");
              setPage(1);
            }}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterTab === "READ"
                ? "bg-(--color-surface) text-(--color-text) shadow-xs font-semibold"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            Read
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
          <span>Total Notifications: <strong className="text-(--color-text)">{paginationMeta.totalItems}</strong></span>
          <span>•</span>
          <span>Showing Page <strong className="text-(--color-text)">{paginationMeta.page}</strong> of <strong className="text-(--color-text)">{paginationMeta.totalPages}</strong></span>
        </div>
      </div>

      {/* Main List */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-(--color-text-muted) gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-(--color-accent)" />
            <p>Loading notification feed...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-1 opacity-80" />
            <p className="text-base font-semibold text-rose-400">{error}</p>
            <p className="text-xs text-(--color-text-muted) max-w-sm">
              We encountered a problem fetching your notification feed from the server.
            </p>
            <button
              onClick={() => fetchNotifications()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface-3) transition-colors cursor-pointer"
            >
              <RefreshCw size={14} /> Retry loading feed
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Inbox className="w-10 h-10 text-(--color-text-faint) mb-3 opacity-40" />
            <p className="text-base font-semibold text-(--color-text)">No notifications found</p>
            <p className="text-xs text-(--color-text-muted) mt-1 max-w-sm">
              {filterTab === "UNREAD"
                ? "You're all caught up! No unread notifications right now."
                : filterTab === "READ"
                ? "No read notifications found in your history."
                : "You don't have any notifications at the moment."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-(--color-border-soft)">
            {notifications.map((n) => {
              const id = n._id || n.id || "";
              return (
                <div
                  key={id}
                  className={`flex items-start justify-between gap-4 p-4 sm:p-5 transition-colors ${
                    !n.isRead ? "bg-(--color-accent-soft)/15" : "hover:bg-(--color-surface-2)/40"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Icon container */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        !n.isRead
                          ? "border-(--color-accent)/30 bg-(--color-accent-soft)/30"
                          : "border-(--color-border) bg-(--color-surface-2)"
                      }`}
                    >
                      {getNotificationIcon(n.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-(--color-text) leading-snug">
                          {n.title}
                        </h4>
                        {!n.isRead && (
                          <Badge tone="accent">NEW</Badge>
                        )}
                        {n.type && (
                          <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-(--color-surface-3) text-(--color-text-muted)">
                            {n.type}
                          </span>
                        )}
                      </div>

                      {/* Full Body Content */}
                      <p className="text-xs sm:text-sm text-(--color-text-muted) mt-1.5 leading-relaxed whitespace-pre-line">
                        {n.body}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-(--color-text-faint)">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatTimeAgo(n.createdAt)}
                        </span>
                        {n.isRead && (
                          <span className="flex items-center gap-1 text-emerald-500/80">
                            <Check size={12} /> Read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2 pt-0.5">
                    {!n.isRead ? (
                      <button
                        onClick={() => handleMarkAsRead(id)}
                        disabled={actionLoading === id}
                        title="Mark as read"
                        className="flex items-center gap-1.5 rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-xs font-medium text-(--color-text-muted) hover:text-(--color-accent) hover:border-(--color-accent)/40 hover:bg-(--color-accent-soft)/20 transition-all"
                      >
                        {actionLoading === id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-(--color-accent)" />
                        )}
                        <span className="hidden sm:inline">Mark as read</span>
                      </button>
                    ) : (
                      <span className="text-xs text-(--color-text-faint) px-2 py-1 italic">Read</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagination Footer */}
      {paginationMeta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
            <span>Items per page:</span>
            <CustomSelect
              value={String(limit)}
              onChange={(v) => {
                setLimit(Number(v));
                setPage(1);
              }}
              compact
              options={[
                { value: "5", label: "5" },
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "50", label: "50" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-xs font-medium text-(--color-text) hover:bg-(--color-surface-3) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} /> Previous
            </button>

            <span className="text-xs text-(--color-text-muted) px-2">
              Page <strong>{page}</strong> of <strong>{paginationMeta.totalPages}</strong>
            </span>

            <button
              onClick={() => setPage((p) => Math.min(paginationMeta.totalPages, p + 1))}
              disabled={page >= paginationMeta.totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-xs font-medium text-(--color-text) hover:bg-(--color-surface-3) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
