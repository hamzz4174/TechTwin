/**
 * TechTwin AI Orb — Reusable Animated Orb Component (#23)
 * Include this script in any page to add the floating AI Orb.
 * It auto-reads user auth state and shows contextual tooltips.
 */
(function () {
    // Don't inject on pages that already have their own orb
    if (document.getElementById("techtwin-ai-orb")) return;

    const user = (() => {
        try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
    })();

    // Create pulse ring
    const ring = document.createElement("div");
    ring.id = "techtwin-orb-ring";
    ring.style.cssText = `
        position:fixed;bottom:18px;right:18px;
        width:88px;height:88px;border-radius:50%;
        border:2px solid rgba(139,92,246,0.25);
        animation:ttOrbRing 3s ease-in-out infinite;
        z-index:9998;pointer-events:none;
    `;

    // Create orb
    const orb = document.createElement("a");
    orb.id = "techtwin-ai-orb";
    orb.href = user ? "doubts.html" : "login.html";
    orb.title = user ? `${user.name}'s AI Twin — Click to ask a doubt` : "Start learning with AI";
    orb.style.cssText = `
        position:fixed;bottom:30px;right:30px;
        width:60px;height:60px;border-radius:50%;
        background:linear-gradient(135deg,#8B5CF6,#0D9488);
        display:flex;align-items:center;justify-content:center;
        font-size:26px;text-decoration:none;
        box-shadow:0 0 25px rgba(139,92,246,0.5),0 8px 24px rgba(0,0,0,0.2);
        animation:ttOrbFloat 3s ease-in-out infinite;
        z-index:9999;border:2px solid rgba(255,255,255,0.15);
        transition:transform 0.2s;
    `;
    orb.textContent = "🤖";
    orb.addEventListener("mouseenter", () => { orb.style.transform = "scale(1.15)"; tooltip.style.opacity = "1"; });
    orb.addEventListener("mouseleave", () => { orb.style.transform = ""; tooltip.style.opacity = "0"; });

    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
        position:fixed;bottom:100px;right:20px;
        background:rgba(15,15,30,0.92);color:white;
        padding:10px 14px;border-radius:12px;font-family:Inter,sans-serif;
        font-size:13px;font-weight:600;white-space:nowrap;
        border:1px solid rgba(139,92,246,0.3);
        box-shadow:0 8px 20px rgba(0,0,0,0.3);
        opacity:0;transition:opacity 0.2s;
        z-index:10000;pointer-events:none;
        backdrop-filter:blur(10px);
    `;
    tooltip.innerHTML = user
        ? `🧠 <strong>${user.name}</strong> · Ask AI a doubt`
        : `🚀 Start your AI learning journey`;

    // CSS Keyframes
    const style = document.createElement("style");
    style.textContent = `
        @keyframes ttOrbFloat {
            0%,100%{transform:translateY(0);box-shadow:0 0 20px rgba(139,92,246,0.4),0 8px 24px rgba(0,0,0,0.2)}
            50%{transform:translateY(-8px);box-shadow:0 0 36px rgba(139,92,246,0.7),0 16px 32px rgba(0,0,0,0.25)}
        }
        @keyframes ttOrbRing {
            0%,100%{transform:scale(1);opacity:0.5}
            50%{transform:scale(1.18);opacity:0.1}
        }
        #techtwin-ai-orb:hover { animation-play-state:paused !important; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(ring);
    document.body.appendChild(orb);
    document.body.appendChild(tooltip);

    // Proactive messages after idle
    const messages = [
        user ? `💡 Hi ${user.name}! Have a doubt? Ask your AI Twin.` : "🚀 Join TechTwin for AI-powered learning!",
        "🔥 Check your learning streak in the AI Hub!",
        "🧬 Explore your Knowledge DNA map today.",
        "📋 Try Instant Revision Mode for quick exam prep.",
        "🏆 Beat your learning streak — you've got this!"
    ];
    let msgIdx = 0;
    setTimeout(() => {
        const proactive = setInterval(() => {
            tooltip.innerHTML = messages[msgIdx % messages.length];
            tooltip.style.opacity = "1";
            msgIdx++;
            setTimeout(() => { tooltip.style.opacity = "0"; }, 4000);
        }, 30000);
    }, 15000);
})();
