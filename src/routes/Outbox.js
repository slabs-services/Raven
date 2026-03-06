import { slugify } from "../Utils.js";

export async function CreateOutbox(req, res) {
    const { domain, name } = req.body;

    if (!domain || !name) {
        return res.status(400).send({ error: "Missing required fields: domain and name" });
    }

    if(req.iamData.fsId !== "urn:slabs:iam:fs:raven:create"){
        res.status(400).send({ error: "You dont have permission to create a outbox." });
        return;
    }

    const slug = slugify(name);
    const outboxId = "urn:slabs:raven:" + slug;

    await req.server.db.query("INSERT INTO outbox (id, domain, name, ownerId) VALUES (?, ?, ?, ?)", [outboxId, domain, name, req.iamData.userId]);

    return { success: true, outboxId };
}

export async function SendEmail(req, res) {
    const { outboxId, from, fromName, subject, text, html, cc, bcc, to } = req.body;

    if (!outboxId || !from || !fromName || !subject || (!text && !html) || (cc && !Array.isArray(cc)) || (bcc && !Array.isArray(bcc)) || (to && !Array.isArray(to))) {
        return res.status(400).send({ error: "Missing required fields: outboxId, from, fromName, subject and either text or html. cc and bcc must be arrays if provided. to must be an array." });
    }

    if(req.iamData.fsId !== "urn:slabs:iam:fs:raven:sendMail" || req.iamData.resourceName !== outboxId){
        res.status(400).send({ error: "You dont have permission to invoke this cloud function." });
        return;
    }

    const maxUsages = req.iamData.extras?.maxUsages;

    if (typeof maxUsages === "number" && maxUsages > 0) {
        try {
            const [trlInfo] = await req.server.db.query("SELECT usages FROM tokensRevoked WHERE tokenId = ?", [req.iamData.jti]);

            if(trlInfo.length === 0){
                await req.server.db.query("INSERT INTO tokensRevoked (tokenId, usages, createdAt, expiresAt) VALUES (?, ?, ?, ?)", [req.iamData.jti, 1, new Date(), new Date((req.iamData.exp*1000)+10000)]);
            }else{
                const currentUsages = trlInfo[0].usages;

                if(currentUsages >= req.iamData.extras.maxUsages){
                    return res.status(401).send({ message: 'Maximum usage limit reached' });
                }

                await req.server.db.query("UPDATE tokensRevoked SET usages = ? WHERE tokenId = ?", [currentUsages + 1, req.iamData.jti]);
            }

        } catch (err) {
            console.error("Error occurred while fetching TRL info:", err);
            return res.status(500).send({ error: "Internal server error" });
        }
    }

    const [outbox] = await req.server.db.query("SELECT domain FROM outbox WHERE id = ?", [outboxId]);

    if (outbox.length === 0) {
        return res.status(404).send({ error: "Outbox not found" });
    }

    try {
        await req.server.mail.sendMail({
            from: `${fromName} <${from}@${outbox[0].domain}>`,
            to,
            cc,
            bcc,
            subject,
            text,
            html
        });
    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).send({ error: "Failed to send email" });
    }

    return { success: true };
}