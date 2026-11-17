import asyncio
import json
import random
import time
import uuid
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch world tick
    tick_task = asyncio.create_task(world_tick())
    yield
    # Shutdown
    tick_task.cancel()

app = FastAPI(title="Loy Krathong Live Interactive Web", lifespan=lifespan)

# In-memory state
players: Dict[str, dict] = {}
krathongs: List[dict] = []
npcs: List[dict] = []
chat_history: List[dict] = []

MAX_KRATHONGS = 12

# Preset NPC names and greetings
NPC_PRESETS = [
    {"name": "น้องมายด์", "char_type": 2, "wish": "ขอให้สอบผ่านทุกวิชา ได้เกรด 4.00 เพี้ยง!"},
    {"name": "บุญมา", "char_type": 1, "wish": "ขอให้ถูกหวยรางวัลที่ 1 ปลดหนี้ปลดสิน"},
    {"name": "ต้นข้าว", "char_type": 3, "wish": "ขอให้สุขภาพแข็งแรง ครอบครัวมีความสุข"},
    {"name": "ยายจันทร์", "char_type": 6, "wish": "ขอขมาพระแม่คงคา ขอให้อยู่เย็นเป็นสุข"},
    {"name": "พี่เสก", "char_type": 7, "wish": "ขอให้ความรักยืนยาว สุขสมหวังทุกประการ"},
    {"name": "น้องฟ้า", "char_type": 4, "wish": "ขอให้งานปัง เงินไหลมาเทมา เฮงๆ รวยๆ"}
]

# Initialize active NPCs (walking on plaza ground)
for i, preset in enumerate(NPC_PRESETS):
    npcs.append({
        "id": f"npc_{i+1}",
        "name": preset["name"],
        "char_type": preset["char_type"],
        "is_npc": True,
        "x": random.randint(220, 580),
        "y": random.randint(680, 880),
        "target_x": random.randint(220, 580),
        "target_y": random.randint(680, 880),
        "action": "wander",
        "last_action_time": time.time(),
        "chat": ""
    })

# Add initial krathongs directly in the river (Y = 1130 to 1240) - Spacious and peaceful
INIT_WISHES = [
    ("ต้นข้าว", "ขอให้ชีวิตสดใส ลอยทุกข์ลอยโศกออกไป", 1),
    ("น้องมายด์", "ขอขมาพระแม่คงคา สุขสมหวังดังใจ", 2),
    ("ยายจันทร์", "ขอให้ลูกหลานร่มเย็นเป็นสุข", 3)
]
now = time.time()
for i, (name, wish, ktype) in enumerate(INIT_WISHES):
    krathongs.append({
        "id": f"init_k_{i}",
        "name": name,
        "wish": wish,
        "type": ktype,
        "x": 120 + i * 260,
        "y": random.uniform(1140, 1230),
        "speed": random.uniform(14, 19),
        "created_at": now - (i * 30)
    })

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def broadcast(self, message: dict):
        payload = json.dumps(message, ensure_ascii=False)
        for client_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_text(payload)
            except Exception:
                pass

manager = ConnectionManager()

# Background task for NPC life cycle and river physics
async def world_tick():
    dog_state = {
        "x": 160, "y": 790, "target_x": 420, "target_y": 800,
        "state": "idle", "has_meatball": False, "timer": time.time()
    }
    
    while True:
        await asyncio.sleep(2.5)
        current_time = time.time()
        
        # Check each NPC
        for npc in npcs:
            if current_time - npc["last_action_time"] > random.uniform(12, 24):
                npc["last_action_time"] = current_time
                choice = random.random()
                if choice < 0.35:
                    npc["action"] = "dance"
                    npc["target_x"] = 410 + random.randint(-30, 30)
                    npc["target_y"] = 720 + random.randint(-15, 15)
                elif choice < 0.60:
                    npc["action"] = "pray"
                    npc["target_x"] = 300 + random.randint(-20, 20)
                    npc["target_y"] = 460 + random.randint(-10, 10)
                elif choice < 0.75:
                    npc["action"] = "ferris"
                    npc["target_x"] = 630 + random.randint(-15, 15)
                    npc["target_y"] = 580 + random.randint(-10, 10)
                else:
                    npc["action"] = "wander"
                    npc["target_x"] = random.randint(200, 580)
                    npc["target_y"] = random.randint(680, 900)
                
                # occasional speech
                if random.random() < 0.25:
                    sample_phrases = ["สุขสันต์วันลอยกระทงจ้า 🪷", "คนเยอะอบอุ่นจัง", "รำวงสนุกมาก!", "สาธุ 🙏", "ชิงช้าสวรรค์สวยมาก ✨"]
                    npc["chat"] = random.choice(sample_phrases)
                else:
                    npc["chat"] = ""

                # Broadcast specific NPC action change so clients interpolate smoothly without snapping!
                await manager.broadcast({
                    "type": "npc_action",
                    "npc_id": npc["id"],
                    "action": npc["action"],
                    "target_x": npc["target_x"],
                    "target_y": npc["target_y"],
                    "chat": npc["chat"]
                })
        
        # Temple Dog logic
        if current_time - dog_state["timer"] > random.uniform(14, 22):
            dog_state["timer"] = current_time
            if not dog_state["has_meatball"]:
                dog_state["state"] = "steal_meatball"
                dog_state["has_meatball"] = True
                dog_state["target_x"] = random.randint(300, 550)
                dog_state["target_y"] = random.randint(780, 840)
            else:
                dog_state["state"] = "sleep_eat"
                dog_state["has_meatball"] = False
                dog_state["target_x"] = random.randint(140, 200)
                dog_state["target_y"] = random.randint(760, 800)
                
            await manager.broadcast({
                "type": "dog_action",
                "dog": dog_state
            })
        
        # Periodic Krathong float by NPCs (Kept minimal and serene: max 5-6 total krathongs)
        if len(krathongs) < 5 and random.random() < 0.12:
            random_npc = random.choice(NPC_PRESETS)
            new_k = {
                "id": f"k_{uuid.uuid4().hex[:8]}",
                "name": random_npc["name"],
                "wish": random_npc["wish"],
                "type": random.choice([1, 2, 3]),
                "x": random.uniform(20, 150),
                "y": random.uniform(1130, 1250),
                "speed": random.uniform(14, 24),
                "created_at": current_time
            }
            krathongs.append(new_k)
            if len(krathongs) > MAX_KRATHONGS:
                krathongs.pop(0)
            await manager.broadcast({
                "type": "krathong_added",
                "krathong": new_k
            })
        
        # Broadcast lightweight online count
        await manager.broadcast({
            "type": "status_ping",
            "online_count": len(manager.active_connections)
        })

# Background world tick runs via lifespan context

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = uuid.uuid4().hex[:8]
    await manager.connect(websocket, client_id)
    
    # Send initial snapshot to newly connected player
    initial_payload = {
        "type": "init_state",
        "client_id": client_id,
        "players": players,
        "npcs": npcs,
        "krathongs": krathongs,
        "chat_history": chat_history[-15:],
        "online_count": len(manager.active_connections)
    }
    await websocket.send_text(json.dumps(initial_payload, ensure_ascii=False))

    try:
        while True:
            data_text = await websocket.receive_text()
            data = json.loads(data_text)
            msg_type = data.get("type")

            if msg_type == "join":
                # Player chose name and avatar
                player_info = {
                    "id": client_id,
                    "name": data.get("name", "ผู้ร่วมงาน").strip() or "ผู้ร่วมงาน",
                    "char_type": int(data.get("char_type", 1)),
                    "x": random.randint(280, 520),
                    "y": random.randint(720, 860),
                    "target_x": random.randint(280, 520),
                    "target_y": random.randint(720, 860),
                    "action": "wander",
                    "chat": "สวัสดีครับ/ค่ะ มาร่วมลอยกระทง 🪷",
                    "is_npc": False
                }
                players[client_id] = player_info
                await manager.broadcast({
                    "type": "player_joined",
                    "player": player_info,
                    "online_count": len(manager.active_connections)
                })

            elif msg_type == "player_action":
                # Action like pray, dance, ferris, sparkler, lantern, move
                if client_id in players:
                    p = players[client_id]
                    action = data.get("action", "wander")
                    p["action"] = action
                    if "target_x" in data:
                        p["target_x"] = data["target_x"]
                    if "target_y" in data:
                        p["target_y"] = data["target_y"]
                    
                    await manager.broadcast({
                        "type": "player_action",
                        "client_id": client_id,
                        "action": action,
                        "target_x": p.get("target_x"),
                        "target_y": p.get("target_y"),
                        "extra": data.get("extra")
                    })

            elif msg_type == "float_krathong":
                if client_id in players:
                    p = players[client_id]
                    # Walk player to pier steps by the water
                    p["action"] = "float"
                    p["target_x"] = random.randint(390, 460)
                    p["target_y"] = 1045
                    
                    # Inform everyone that player is floating a krathong
                    await manager.broadcast({
                        "type": "player_action",
                        "client_id": client_id,
                        "action": "float",
                        "target_x": p["target_x"],
                        "target_y": p["target_y"]
                    })

                    # Create Krathong directly inside the Chao Phraya river water!
                    new_k = {
                        "id": f"k_{uuid.uuid4().hex[:8]}",
                        "owner_id": client_id,
                        "name": p["name"],
                        "wish": data.get("wish", "ขอให้มีความสุข สมหวังทุกประการ") or "ขอให้มีความสุข สมหวังทุกประการ",
                        "type": int(data.get("krathong_type", 1)),
                        "x": p["target_x"] + random.uniform(-15, 25),
                        "y": random.uniform(1140, 1220),
                        "speed": random.uniform(14, 22),
                        "created_at": time.time()
                    }
                    krathongs.append(new_k)
                    if len(krathongs) > MAX_KRATHONGS:
                        krathongs.pop(0)

                    await manager.broadcast({
                        "type": "krathong_added",
                        "krathong": new_k,
                        "client_id": client_id
                    })

            elif msg_type == "chat":
                if client_id in players:
                    p = players[client_id]
                    message_text = data.get("message", "").strip()
                    if message_text:
                        p["chat"] = message_text
                        chat_entry = {
                            "name": p["name"],
                            "char_type": p["char_type"],
                            "message": message_text,
                            "time": time.strftime("%H:%M")
                        }
                        chat_history.append(chat_entry)
                        if len(chat_history) > 30:
                            chat_history.pop(0)

                        await manager.broadcast({
                            "type": "chat_message",
                            "client_id": client_id,
                            "name": p["name"],
                            "message": message_text
                        })

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        if client_id in players:
            del players[client_id]
        await manager.broadcast({
            "type": "player_left",
            "client_id": client_id,
            "online_count": len(manager.active_connections)
        })

# Serve static files
app.mount("/static", StaticFiles(directory="public"), name="static")

@app.get("/")
async def root():
    return FileResponse("public/index.html")

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    print("============================================================")
    print(" LOY KRATHONG LIVE INTERACTIVE APP ")
    print(f" Running at http://localhost:{port} ")
    print(" Mobile Friendly / Real-time WebSockets ")
    print("============================================================")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
