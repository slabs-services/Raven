export async function CheckOwner(req, reply) {
    if(req.host !== 'outbox.raven.slabs.pt'){
        return reply.status(404).send({
            "message": "Invalid Route"
        });
    }

    const resourceName = req.query.resourceName;
    const accountRequested = req.query.accountRequested;

    if(!accountRequested){
        return reply.status(400).send({
            "message": "Missing Resource Name or Account Requested"
        });
    }

    if(resourceName === ""){
        return reply.status(200).send({
            "message": "Owner OK"
        });
    }

    const [ownerCheck] = await req.server.db.query("SELECT id FROM outbox WHERE id = ? AND ownerId = ?", [resourceName, accountRequested]);

    if(ownerCheck.length === 0){
        return reply.status(401).send({
            "message": "Resource does not exists or is not the owner."
        });
    }else{
        return reply.status(200).send({
            "message": "Owner OK"
        });
    }
}