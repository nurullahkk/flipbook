// Bu dosya, projenizin ana dizininde bulunan 'api' adlı bir klasörün içine yerleştirilmelidir.
// Dosya yolu: /api/chat.js

export default async function handler(req, res) {
// Sadece POST metoduyla gelen isteklere izin ver
if (req.method !== 'POST') {
res.setHeader('Allow', ['POST']);
return res.status(405).end(Method ${req.method} Not Allowed);
}

try {
    // API anahtarını sunucu ortam değişkenlerinden (environment variables) güvenli bir şekilde al
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        console.error("GEMINI_API_KEY ortam değişkeni ayarlanmamış.");
        return res.status(500).json({ error: 'API anahtarı sunucuda yapılandırılmamış.' });
    }

    // İstek gövdesinden kullanıcının sorusunu ve PDF metnini al
    const { query: userQuery, context: fullPdfTextContext } = req.body;

    if (!userQuery || !fullPdfTextContext) {
        return res.status(400).json({ error: 'İstekte `query` veya `context` eksik.' });
    }

    // Gemini API'si için komutu (prompt) oluştur
    const prompt = `Sen, bir PDF belgesi hakkında soruları yanıtlayan bir asistansın.
    Sana aşağıda sayfa numaralarıyla etiketlenmiş belge içeriği verilecek.
    Kullanıcının sorusunu bu içeriğe dayanarak yanıtla.
    Yanıtların kısa ve öz olsun. Mümkünse, cevabın bulunduğu sayfa numarasını belirt (örneğin, "[Sayfa 5]'e göre...").
    Eğer cevap belgede yoksa, "Bu bilgi belgede bulunmuyor." de.
    
    BELGE İÇERİĞİ:
    ---
    ${fullPdfTextContext}
    ---
    
    KULLANICI SORUSU: "${userQuery}"
    
    YANITIN:`;

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 500
        }
    };

    // Google Gemini API'sine isteği gönder
    const apiResponse = await fetch(googleApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        console.error('Google API Hatası:', errorData);
        throw new Error(errorData.error?.message || `Google API hatası: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    const responseText = data.candidates[0].content.parts[0].text;

    // Gelen cevabı frontend'e geri gönder
    res.status(200).json({ text: responseText });

} catch (error) {
    console.error('Sunucu tarafı hatası:', error);
    res.status(500).json({ error: error.message || 'İç sunucu hatası oluştu.' });
}

}