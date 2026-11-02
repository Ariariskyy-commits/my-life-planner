/**
 * MY LITTLE OFFICE — Gemini API proxy for Cloudflare Workers
 *
 * Deploy as a Cloudflare Worker.
 * Add GEMINI_API_KEY as a Worker Secret (never commit the key).
 * Endpoint accepts POST { agentId, task } and returns { text }.
 */

const MODEL = "gemini-3.5-flash-lite";
const MAX_TASK_CHARS = 2000;

const AGENTS = {
  brief: {
    name: "Brief Analyst",
    role: "วิเคราะห์โจทย์และสรุปบรีฟ",
    instruction: "วิเคราะห์โจทย์ให้ชัด ระบุเป้าหมาย กลุ่มเป้าหมาย ข้อจำกัด และข้อมูลที่ยังขาด ถ้าข้อมูลไม่พอให้บอกสมมติฐานอย่างชัดเจน"
  },
  research: {
    name: "Researcher",
    role: "วางแผนค้นคว้าและตรวจสอบข้อมูล",
    instruction: "ช่วยวางแผนค้นคว้า แยกข้อเท็จจริงออกจากข้อสันนิษฐาน เสนอคำค้นและแหล่งข้อมูลที่ควรตรวจสอบ ห้ามแต่งแหล่งอ้างอิงหรืออ้างว่าค้นเว็บแล้วถ้ายังไม่ได้ค้น"
  },
  writer: {
    name: "Writer",
    role: "เขียนและเรียบเรียงเนื้อหา",
    instruction: "เขียนภาษาไทยให้เป็นธรรมชาติ ตรงกลุ่มเป้าหมาย จัดโครงสร้างให้อ่านง่าย และรักษารายละเอียดตามโจทย์"
  },
  designer: {
    name: "Designer",
    role: "คิดไอเดียภาพและดีไซน์",
    instruction: "เสนอแนวคิดงานภาพที่นำไปทำต่อได้ ระบุ mood and tone สี องค์ประกอบ ลำดับสายตา ตัวอักษร และรูปแบบการจัดวางอย่างเป็นรูปธรรม"
  },
  director: {
    name: "Creative Director",
    role: "ตัดสินใจและรวมงาน",
    instruction: "ประเมินทางเลือก เปรียบเทียบข้อดีข้อเสีย เลือกแนวทางที่เหมาะที่สุด พร้อมเหตุผลและรายการสิ่งที่ต้องทำต่อ"
  },
  qc: {
    name: "QC",
    role: "ตรวจคุณภาพ",
    instruction: "ตรวจความถูกต้อง ความครบถ้วน ภาษา ความสม่ำเสมอ และความพร้อมใช้งาน สรุปข้อผิดพลาดและวิธีแก้เป็นข้อ ๆ"
  }
};

const ALLOWED_ORIGINS = new Set([
  "https://ariariskyy-commits.github.io",
  "https://raw.githack.com"
]);
const FIREBASE_API_KEY = "AIzaSyAXBrkRElXiLTfeEB5iWDiiZlV-07wfXlc";
const ALLOWED_EMAIL = "arisky.studio@gmail.com";

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://ariariskyy-commits.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

async function verifyFirebaseToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  try {
    const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: match[1] })
    });
    if (!response.ok) return false;
    const data = await response.json();
    const user = data && data.users && data.users[0];
    return !!user &&
      String(user.email || "").toLowerCase() === ALLOWED_EMAIL &&
      user.emailVerified === true &&
      user.disabled !== true;
  } catch {
    return false;
  }
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, "https://ariariskyy-commits.github.io");
    }

    if (!await verifyFirebaseToken(request)) {
      return json({ error: "ต้องเข้าสู่ระบบด้วย arisky.studio@gmail.com ก่อนใช้งาน AI" }, 401, origin);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Worker Secrets" }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, 400, origin);
    }

    const agentId = String(body.agentId || "");
    const task = String(body.task || "").trim().slice(0, MAX_TASK_CHARS);
    const agent = AGENTS[agentId];

    if (!agent) return json({ error: "ไม่พบพนักงานตำแหน่งนี้" }, 400, origin);
    if (!task) return json({ error: "กรุณาระบุงานที่ต้องการ" }, 400, origin);

    const prompt = [
      "คุณคือ " + agent.name + " (" + agent.role + ") ในทีม MY LITTLE OFFICE",
      agent.instruction,
      "ตอบเป็นภาษาไทย ใช้หัวข้อหรือรายการเมื่อช่วยให้อ่านง่าย ตอบให้ตรงงาน ไม่กล่าวอ้างว่าทำสิ่งที่ไม่ได้ทำ",
      "หากโจทย์เกี่ยวข้องกับข้อมูลปัจจุบัน ให้แจ้งว่าต้องตรวจสอบแหล่งข้อมูลล่าสุดก่อนยืนยัน",
      "",
      "งานที่ได้รับ:",
      task
    ].join("\n");

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1400
            }
          })
        }
      );

      const result = await response.json();
      if (!response.ok) {
        const message = result && result.error && result.error.message
          ? result.error.message
          : "Gemini API ตอบกลับไม่สำเร็จ";
        return json({ error: message }, response.status, origin);
      }

      const text = (result.candidates || [])
        .flatMap(candidate => candidate.content && candidate.content.parts ? candidate.content.parts : [])
        .map(part => part.text || "")
        .join("\n")
        .trim();

      if (!text) return json({ error: "Gemini ไม่ได้ส่งข้อความกลับมา ลองสั่งงานอีกครั้ง" }, 502, origin);
      return json({ text }, 200, origin);
    } catch (error) {
      return json({ error: "เชื่อมต่อ Gemini ไม่สำเร็จ: " + String(error.message || error) }, 502, origin);
    }
  }
};
