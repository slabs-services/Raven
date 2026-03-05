import { v4 as uuidv4 } from 'uuid';

export async function SwapRavenService(req, res) {
    const { serviceId } = req.body;

    if (!serviceId) {
        return res.status(400).send({ error: "Missing required fields: serviceId" });
    }

    if(req.iamData.fsId !== "urn:slabs:iam:fs:raven:swap-service"){
        res.status(400).send({ error: "You dont have permission to swap a service." });
        return;
    }

    const [previusService] = await req.server.db.query("SELECT isEnable FROM serviceEnabled WHERE ownerId = ?", [req.iamData.userId]);

    if(previusService.length > 0){
        await req.server.db.query("UPDATE serviceEnabled SET isEnable = ? WHERE ownerId = ?", [!previusService[0].isEnable, req.iamData.userId]);
    }else{
        await req.server.db.query("INSERT INTO serviceEnabled (id, isEnable, ownerId) VALUES (?, ?, ?)", [uuidv4(), 1, req.iamData.userId]);
    }

    return { success: true };
}