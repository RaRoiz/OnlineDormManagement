import "./avatar-crop.css";
export function cropRect(width: number, height: number, zoom: number, x: number, y: number) {
  const size = Math.min(width, height) / Math.max(1, zoom);
  return { size, x: (width - size) * Math.max(0, Math.min(1, x)), y: (height - size) * Math.max(0, Math.min(1, y)) };
}
export async function cropAvatar(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("เปิดรูปไม่ได้ กรุณาใช้ JPG, PNG หรือ WebP"));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw new Error("รูปมีความละเอียดสูงเกินไป กรุณาเลือกรูปที่เล็กลง");
    return await new Promise<string | null>((resolve, reject) => {
      const dialog = document.createElement("dialog");
      dialog.className = "avatar-crop-dialog";
      dialog.setAttribute("aria-label", "ปรับรูปโปรไฟล์");
      const title = document.createElement("h3"); title.textContent = "ปรับรูปโปรไฟล์";
      const hint = document.createElement("p"); hint.textContent = "ปรับซูมและตำแหน่งให้พอดีกรอบก่อนบันทึก";
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      canvas.setAttribute("aria-label", "ตัวอย่างรูปโปรไฟล์");
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("เบราว์เซอร์ไม่รองรับการปรับรูป")); return; }
      const controls = document.createElement("div");
      const slider = (text: string, min: string, max: string, value: string) => {
        const label = document.createElement("label"); label.textContent = text;
        const input = document.createElement("input");
        input.type = "range"; input.min = min; input.max = max; input.step = "0.01"; input.value = value;
        input.addEventListener("input", draw); label.append(input); controls.append(label); return input;
      };
      const zoom = slider("ซูม", "1", "3", "1");
      const x = slider("ตำแหน่งซ้าย–ขวา", "0", "1", "0.5");
      const y = slider("ตำแหน่งบน–ล่าง", "0", "1", "0.5");
      function draw() {
        const r = cropRect(img.naturalWidth, img.naturalHeight, +zoom.value, +x.value, +y.value);
        ctx!.clearRect(0, 0, 512, 512);
        ctx!.drawImage(img, r.x, r.y, r.size, r.size, 0, 0, 512, 512);
      }
      const actions = document.createElement("div"); actions.className = "avatar-crop-actions";
      const cancel = document.createElement("button");
      cancel.type = "button"; cancel.className = "secondary-button"; cancel.textContent = "ยกเลิก";
      const save = document.createElement("button");
      save.type = "button"; save.className = "primary-button"; save.textContent = "ใช้รูปนี้";
      let output: string | null = null;
      cancel.onclick = () => dialog.close();
      save.onclick = () => {
        try { output = canvas.toDataURL("image/png").split(",")[1]; dialog.close(); }
        catch { reject(new Error("ปรับรูปไม่สำเร็จ กรุณาลองใหม่")); dialog.close(); }
      };
      dialog.addEventListener("close", () => { dialog.remove(); resolve(output); }, { once: true });
      actions.append(cancel, save); dialog.append(title, hint, canvas, controls, actions); document.body.append(dialog);
      try { draw(); dialog.showModal(); } catch (error) { dialog.remove(); reject(error); }
    });
  } finally { URL.revokeObjectURL(url); }
}
