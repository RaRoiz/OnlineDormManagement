/**
 * Arrears.gs — ยอดค้างชำระสะสมจากเดือนก่อน
 *
 * นิยาม "ยอดค้างเก่า" ของบิลใบหนึ่ง:
 *   ผลรวมบิลของผู้เช่าคนเดียวกัน ที่เดือนเรียกเก็บเก่ากว่าใบนี้
 *   และสถานะยังเป็น UNPAID
 *
 * ทำไมไม่นับ PENDING:
 *   PENDING แปลว่าผู้เช่าส่งสลิปมาแล้วรอเจ้าของหอตรวจสอบ
 *   ถ้านับเป็นยอดค้างจะกลายเป็นทวงซ้ำทั้งที่เขาโอนมาแล้ว
 *   จึงแยกไปเป็นยอด "รอตรวจสอบ" ต่างหาก
 *
 * หมายเหตุ: สถานะ OVERDUE ไม่มีอยู่ในชีต — ฝั่งเว็บคำนวณเอง
 * จากวันครบกำหนดเทียบกับวันนี้ ในชีตมีแค่ UNPAID/PENDING/PAID
 *
 * ทุกฟังก์ชันรับ rows แบบ "ไม่รวมหัวตาราง" เหมือน readReportSheet_
 */

const ARREARS_UNPAID_STATUS = "UNPAID";
const ARREARS_PENDING_STATUS = "PENDING";

function arrearsBillStatus_(row, index) {
  return String(
    row[index.paymentStatus] || ""
  )
    .trim()
    .toUpperCase();
}

/** ดึงเฉพาะฟิลด์ที่ต้องใช้ แล้วจัดกลุ่มตามผู้เช่า */
function groupBillsByTenant_(rows, index) {
  const byTenant = {};

  rows.forEach(function (row) {
    const billId = String(
      row[index.billId] || ""
    ).trim();

    const tenantId = String(
      row[index.tenantId] || ""
    ).trim();

    if (!billId || !tenantId) {
      return;
    }

    if (!byTenant[tenantId]) {
      byTenant[tenantId] = [];
    }

    byTenant[tenantId].push({
      billId: billId,
      tenantId: tenantId,

      tenantName: String(
        row[index.tenantName] || ""
      ).trim(),

      roomNo: String(
        row[index.roomNo] || ""
      ).trim(),

      month: normalizeBillMonth_(
        row[index.billingMonth]
      ),

      amount: Number(
        row[index.totalAmount] || 0
      ),

      status: arrearsBillStatus_(row, index)
    });
  });

  return byTenant;
}

/**
 * คำนวณยอดค้างเก่าให้ทุกบิลในครั้งเดียว
 * คืน map: billId -> { amount, count, oldestMonth }
 *
 * เทียบเดือนแบบสตริง "YYYY-MM" ซึ่งเรียงลำดับตรงกับเวลาจริงอยู่แล้ว
 */
function buildArrearsIndex_(rows, index) {
  const byTenant = groupBillsByTenant_(rows, index);
  const byBillId = {};

  Object.keys(byTenant).forEach(function (tenantId) {
    const bills = byTenant[tenantId];

    bills.forEach(function (bill) {
      let amount = 0;
      let count = 0;
      let oldestMonth = "";

      bills.forEach(function (other) {
        if (other.billId === bill.billId) {
          return;
        }

        if (other.status !== ARREARS_UNPAID_STATUS) {
          return;
        }

        // นับเฉพาะบิลที่เดือนเก่ากว่าใบนี้เท่านั้น
        if (!bill.month || !other.month) {
          return;
        }

        if (other.month >= bill.month) {
          return;
        }

        amount += other.amount;
        count++;

        if (!oldestMonth || other.month < oldestMonth) {
          oldestMonth = other.month;
        }
      });

      byBillId[bill.billId] = {
        amount: amount,
        count: count,
        oldestMonth: oldestMonth
      };
    });
  });

  return byBillId;
}

/**
 * สรุปยอดค้างทั้งระบบ + รายชื่อผู้เช่าที่ค้าง เรียงจากมากไปน้อย
 * ใช้ในหน้า Dashboard
 */
function summarizeArrears_(rows, index) {
  const byTenant = groupBillsByTenant_(rows, index);

  let totalAmount = 0;
  let totalBills = 0;
  let pendingAmount = 0;
  let pendingBills = 0;

  const tenants = [];

  Object.keys(byTenant).forEach(function (tenantId) {
    const bills = byTenant[tenantId];

    let amount = 0;
    let count = 0;
    let oldestMonth = "";

    let tenantName = "";
    let roomNo = "";

    bills.forEach(function (bill) {
      // เก็บชื่อ/ห้องจากบิลใบล่าสุดที่มีข้อมูล
      if (bill.tenantName) {
        tenantName = bill.tenantName;
      }

      if (bill.roomNo) {
        roomNo = bill.roomNo;
      }

      if (bill.status === ARREARS_PENDING_STATUS) {
        pendingAmount += bill.amount;
        pendingBills++;
        return;
      }

      if (bill.status !== ARREARS_UNPAID_STATUS) {
        return;
      }

      amount += bill.amount;
      count++;

      if (!oldestMonth || bill.month < oldestMonth) {
        oldestMonth = bill.month;
      }
    });

    if (count === 0) {
      return;
    }

    totalAmount += amount;
    totalBills += count;

    tenants.push({
      tenantId: tenantId,
      tenantName: tenantName,
      roomNo: roomNo,
      amount: amount,
      count: count,
      oldestMonth: oldestMonth
    });
  });

  tenants.sort(function (a, b) {
    return b.amount - a.amount;
  });

  return {
    totalAmount: totalAmount,
    totalBills: totalBills,
    pendingAmount: pendingAmount,
    pendingBills: pendingBills,
    tenants: tenants
  };
}
