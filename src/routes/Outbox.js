import { slugify } from "../Utils.js";

export async function CreateOutbox(req, res) {
    const { domain, name } = req.body;

    if (!domain || !name) {
        return res.status(400).send({ error: "Missing required fields: domain and name" });
    }

    if(req.iamData.singleTarget){
        if(req.iamData.fsId !== "urn:slabs:iam:fs:raven:create"){
            res.status(400).send({ error: "You dont have permission to create an outbox." });
            return;
        }

        const maxUsages = req.iamData.extras?.maxUsages;

        if (typeof maxUsages === "number" && maxUsages > 0) {
            try {
                const [trlInfo] = await req.server.db.query("SELECT usages FROM tokensRevoked WHERE tokenId = ? AND fsId = ?", [req.iamData.jti, "urn:slabs:iam:fs:raven:create"]);

                if(trlInfo.length === 0){
                    await req.server.db.query("INSERT INTO tokensRevoked (tokenId, usages, createdAt, expiresAt, fsId) VALUES (?, ?, ?, ?, ?)", [req.iamData.jti, 1, new Date(), new Date((req.iamData.exp*1000)+10000), "urn:slabs:iam:fs:raven:create"]);
                }else{
                    const currentUsages = trlInfo[0].usages;

                    if(currentUsages >= req.iamData.extras.maxUsages){
                        return reply.code(401).send({ message: 'Maximum usage limit reached' });
                    }

                    await req.server.db.query("UPDATE tokensRevoked SET usages = ? WHERE tokenId = ? AND fsId = ?", [currentUsages + 1, req.iamData.jti, "urn:slabs:iam:fs:raven:create"]);
                }

            } catch (err) {
                console.error("Error occurred while fetching TRL info:", err);
                return reply.code(500).send({ error: "Internal server error" });
            }
        }
    }else{
        const roles = req.iamData.roles;

        if (!Array.isArray(roles)) {
            return reply.code(403).send({ message: "Invalid Token (missing roles)" });
        }

        const canPut = roles.some((p) =>
            p.fsId === "urn:slabs:iam:fs:raven:create" && p.targetURN === lakeId
        );

        if (!canPut) {
            return reply.code(403).send({ message: "Invalid Permission" });
        }

        const maxUsages = roles.reduce((max, role) => {
            if (role.fsId === "urn:slabs:iam:fs:raven:create") {
                const roleMaxUsages = role.extras?.maxUsages;
                if (typeof roleMaxUsages === "number" && roleMaxUsages > 0) {
                    return Math.max(max, roleMaxUsages);
                }
            }
            return max;
        }, 0);

        if (maxUsages > 0) {
            try {
                const [trlInfo] = await req.server.db.query("SELECT usages FROM tokensRevoked WHERE tokenId = ? AND fsId = ?", [req.iamData.jti, "urn:slabs:iam:fs:raven:create"]);

                if(trlInfo.length === 0){
                    await req.server.db.query("INSERT INTO tokensRevoked (tokenId, usages, createdAt, expiresAt, fsId) VALUES (?, ?, ?, ?, ?)", [req.iamData.jti, 1, new Date(), new Date((req.iamData.exp*1000)+10000), "urn:slabs:iam:fs:raven:create"]);
                }else{
                    const currentUsages = trlInfo[0].usages;

                    if(currentUsages >= maxUsages){
                        return reply.code(401).send({ message: 'Maximum usage limit reached' });
                    }

                    await req.server.db.query("UPDATE tokensRevoked SET usages = ? WHERE tokenId = ? AND fsId = ?", [currentUsages + 1, req.iamData.jti, "urn:slabs:iam:fs:raven:create"]);
                }
                
            }catch (err) {
                console.error("Error occurred while fetching TRL info:", err);
                return reply.code(500).send({ error: "Internal server error" });
            }
        }
    }
    
    const slug = slugify(name);
    const outboxId = "urn:slabs:raven:" + slug;

    await req.server.db.query("INSERT INTO outbox (id, domain, name, ownerId) VALUES (?, ?, ?, ?)", [outboxId, domain, name, req.iamData.userId]);

    return { success: true, outboxId };
}