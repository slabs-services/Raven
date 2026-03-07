export async function checkSendMailPermissionsMultiple(req, outboxId, from, fromName, to, cc, bcc) {
    const roles = req.iamData.roles;
    if (!Array.isArray(roles)) {
        return reply.code(403).send({ message: "Invalid Token (missing roles)" });
    }

    const canPut = roles.some((p) =>
        p.fsId === "urn:slabs:iam:fs:raven:sendMail" && p.targetURN === outboxId
    );

    if (!canPut) {
        return { allowed: false, message: "Invalid Permission" };
    }

    const maxUsages = req.iamData.roles.reduce((max, role) => {
        if (role.fsId === "urn:slabs:iam:fs:raven:sendMail" && role.targetURN === outboxId) {
            const roleMaxUsages = role.extras?.maxUsages;
            if (typeof roleMaxUsages === "number" && roleMaxUsages > max) {
                return roleMaxUsages;
            }
        }
        return max;
    }, 0);

    if (maxUsages > 0) {
        try {
            const [trlInfo] = await req.server.db.query("SELECT usages FROM tokensRevoked WHERE tokenId = ? AND fsId = ?", [req.iamData.jti, "urn:slabs:iam:fs:raven:sendMail"]);

            if(trlInfo.length === 0){
                await req.server.db.query("INSERT INTO tokensRevoked (tokenId, usages, createdAt, expiresAt, fsId) VALUES (?, ?, ?, ?, ?)", [req.iamData.jti, 1, new Date(), new Date((req.iamData.exp*1000)+10000), "urn:slabs:iam:fs:raven:sendMail"]);
            }else{
                const currentUsages = trlInfo[0].usages;
                if(currentUsages >= maxUsages){
                    return { allowed: false, message: 'Maximum usage limit reached' };
                }
                await req.server.db.query("UPDATE tokensRevoked SET usages = ? WHERE tokenId = ? AND fsId = ?", [currentUsages + 1, req.iamData.jti, "urn:slabs:iam:fs:raven:sendMail"]);
            }
        } catch (err) {
            console.error("Error occurred while fetching TRL info:", err);
            return { allowed: false, message: "Internal server error" };
        }
    }

    const allowedFromNames = req.iamData.roles.reduce((names, role) => {
        if (role.fsId === "urn:slabs:iam:fs:raven:sendMail" && role.targetURN === outboxId) {
            const roleAllowedFromNames = role.extras?.allowedFromNames;
            if (typeof roleAllowedFromNames === "string") {
                const separatedNames = roleAllowedFromNames.split(",").map(name => name.trim());
                return names.concat(separatedNames);
            }
        }
        return names;
    }, []);

    if (allowedFromNames.length > 0 && !allowedFromNames.includes(fromName)) {
        return { allowed: false, message: "Invalid Permission (fromName not allowed)" };
    }

    const allowedFroms = req.iamData.roles.reduce((froms, role) => {
        if (role.fsId === "urn:slabs:iam:fs:raven:sendMail" && role.targetURN === outboxId) {
            const roleAllowedFroms = role.extras?.allowedFroms;
            if (typeof roleAllowedFroms === "string") {
                const separatedFroms = roleAllowedFroms.split(",").map(email => email.trim());
                return froms.concat(separatedFroms);
            }
        }
        return froms;
    }, []);

    if (allowedFroms.length > 0 && !allowedFroms.includes(from)) {
        return { allowed: false, message: "Invalid Permission (from email not allowed)" };
    }

    const allowedDestinations = req.iamData.roles.reduce((destinations, role) => {
        if (role.fsId === "urn:slabs:iam:fs:raven:sendMail" && role.targetURN === outboxId) {
            const roleAllowedDestinations = role.extras?.allowedDestinations;
            if (typeof roleAllowedDestinations === "string") {
                const separatedDestinations = roleAllowedDestinations.split(",").map(email => email.trim());
                return destinations.concat(separatedDestinations);
            }
        }
        return destinations;
    }, []);

    if (allowedDestinations.length > 0) {
        const allRecipients = [...(to || []), ...(cc || []), ...(bcc || [])];
        const hasInvalidDestination = allRecipients.some(recipient => !allowedDestinations.includes(recipient));
        if (hasInvalidDestination) {
            return { allowed: false, message: "Invalid Permission (one or more destination emails not allowed)" };
        }
    }

    const maxDestinations = req.iamData.roles.reduce((max, role) => {
        if (role.fsId === "urn:slabs:iam:fs:raven:sendMail" && role.targetURN === outboxId) {
            const roleMaxDestinations = role.extras?.maxDestinations;
            if (typeof roleMaxDestinations === "number" && roleMaxDestinations > max) {
                return roleMaxDestinations;
            }
        }
        return max;
    }, 0);

    if (maxDestinations > 0) {
        const totalRecipients = (to ? to.length : 0) + (cc ? cc.length : 0) + (bcc ? bcc.length : 0);
        if (totalRecipients > maxDestinations) {
            return { allowed: false, message: "Invalid Permission (exceeds maximum number of destinations)" };
        }
    }
}