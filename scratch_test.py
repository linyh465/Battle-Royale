import asyncio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import httpx

app = FastAPI()

@app.get("/docs", include_in_schema=False)
async def docs_redirect():
    return RedirectResponse(url="/docs/")

app.mount("/docs", StaticFiles(directory="docs", html=True), name="mkdocs")

if __name__ == "__main__":
    async def main():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            r1 = await client.get("/docs/")
            print("/docs/ ->", r1.status_code)
            r2 = await client.get("/docs", follow_redirects=False)
            print("/docs  ->", r2.status_code, r2.headers.get("location"))
    asyncio.run(main())
