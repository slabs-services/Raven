import { checkSendMailPermissionsMultiple } from "../Services/Permissions/Multiple.js";
import { checkSendMailPermissionsSingle } from "../Services/Permissions/Single.js";

export async function SendEmail(req, res) {
    const { outboxId, from, fromName, subject, text, html, cc, bcc, to } = req.body;

    if (!outboxId || !from || !fromName || !subject || (!text && !html) || (cc && !Array.isArray(cc)) || (bcc && !Array.isArray(bcc)) || (to && !Array.isArray(to))) {
        return res.status(400).send({ error: "Missing required fields: outboxId, from, fromName, subject and either text or html. cc and bcc must be arrays if provided. to must be an array." });
    }

    if(req.iamData.singleTarget){
        const { allowed, message } = await checkSendMailPermissionsSingle(req, outboxId, from, fromName, to, cc, bcc);

        if (!allowed) {
            return res.status(403).send({ message });
        }
    }else{
        const { allowed, message } = await checkSendMailPermissionsMultiple(req, outboxId, from, fromName, to, cc, bcc);

        if (!allowed) {
            return res.status(403).send({ message });
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