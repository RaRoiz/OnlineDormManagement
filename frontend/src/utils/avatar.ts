import { getCurrentUser, getToken, type User } from "../services/auth.service";
import { apiRequest } from "../types/api";
let key = "";
let pending: Promise<string> | undefined;
const versions = new WeakMap<HTMLElement, object>();
const watched = new WeakSet<HTMLElement>();
function load(user: User): Promise<string> {
  const nextKey = `${getToken()}:${user.userId}:${user.avatarUrl}`;
  if (key !== nextKey || !pending) {
    key = nextKey;
    pending = apiRequest<{ success: boolean; message: string; data?: { mimeType: string; base64Data: string } }>({ action: "getOwnAvatar", token: getToken() })
      .then(result => {
        if (!result.success) throw new Error(result.message);
        if (!result.data) return "";
        if (!["image/jpeg", "image/png", "image/webp"].includes(result.data.mimeType)) throw new Error("Invalid image");
        return `data:${result.data.mimeType};base64,${result.data.base64Data}`;
      });
    const current = pending;
    void current.catch(() => { if (pending === current) pending = undefined; });
  }
  return pending;
}
export function renderAvatar(container: HTMLElement, user: User | null): void {
  const version = {};
  versions.set(container, version);
  container.classList.add("avatar-circle");
  container.classList.remove("has-photo");
  container.style.backgroundImage = "";
  container.textContent = "👤";
  container.title = "รูปโปรไฟล์";
  if (!watched.has(container)) {
    watched.add(container);
    window.addEventListener("profile-updated", () => { if (container.isConnected) renderAvatar(container, getCurrentUser()); });
  }
  if (!user) return;
  const failed = () => { if (versions.get(container) === version) container.title = "โหลดรูปไม่สำเร็จ กรุณาลองใหม่หรือตรวจการเผยแพร่ Apps Script"; };
  void load(user).then(src => {
    if (!src || versions.get(container) !== version) return;
    const img = new Image();
    img.alt = "รูปโปรไฟล์";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit";
    img.onload = () => {
      if (versions.get(container) !== version) return;
      container.replaceChildren(img);
      container.classList.add("has-photo");
    };
    img.onerror = failed;
    img.src = src;
  }).catch(failed);
}
