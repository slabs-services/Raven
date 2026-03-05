import { slugify } from "../Utils.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "raven.spacelabs.pt",
    port: 587,
    secure: false,
    auth: { user: "smtpuser", pass: "" },
    tls: {
        rejectUnauthorized: false
    }
});

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
    const { outboxId, from, to, subject, text, html } = req.body;

    if (!outboxId || !from || !to || !subject || (!text && !html)) {
        return res.status(400).send({ error: "Missing required fields: outboxId, from, to, subject and either text or html" });
    }

    if(req.iamData.fsId !== "urn:slabs:iam:fs:raven:sendMail" || req.iamData.resourceName !== outboxId){
        res.status(400).send({ error: "You dont have permission to invoke this cloud function." });
        return;
    }

    const [outbox] = await req.server.db.query("SELECT * FROM outbox WHERE id = ?", [outboxId]);

    if (outbox.length === 0) {
        return res.status(404).send({ error: "Outbox not found" });
    }

    const info = await transporter.sendMail({
        from: "No-Reply <no-reply@test.spacelabs.pt>",
        to: "",
        subject: "Este é um mail da Infra da SpaceLabs",
        text: "Mail da Infra",
        html: '<h1>Mail de Teste</h1>'
    });
}