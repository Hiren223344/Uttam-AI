export async function uploadToPollinations(base64Data: string, mimeType: string, filename: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPEN_AI_API; // Using the pollinations key from env

    // Convert base64 to buffer
    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);

    const response = await fetch("https://media.pollinations.ai/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return data.url; 
    } else {
      console.error("[Media Upload] Error:", response.status, await response.text());
      return null;
    }
  } catch (err) {
    console.error("[Media Upload] Exception:", err);
    return null;
  }
}
