/**
 * Vercel Serverless Function - GSTIN Lookup Proxy
 * Uses Sandbox.co.in GSP API endpoint for public GSTIN details.
 * 
 * Environment Variables (Set in Vercel Project Settings):
 * - SANDBOX_API_KEY: Your Sandbox.co.in API Key
 * - SANDBOX_API_SECRET: (Optional) Your Sandbox Secret
 */

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { gstin, apiKey: userApiKey } = req.query;

    if (!gstin || gstin.trim().length !== 15) {
        return res.status(400).json({ error: 'Please provide a valid 15-digit GSTIN' });
    }

    const cleanGstin = gstin.trim().toUpperCase();

    // Indian State Codes mapping
    const stateCodes = {
        '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
        '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
        '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
        '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
        '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
        '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
        '28': 'Andhra Pradesh (Old)', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
        '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
        '36': 'Telangana', '37': 'Andhra Pradesh (New)', '38': 'Ladakh', '97': 'Other Territory'
    };

    const stateCodeDigits = cleanGstin.substring(0, 2);
    const estimatedState = stateCodes[stateCodeDigits] || '';

    // API Key from Vercel environment variables or passed from UI
    const apiKey = userApiKey || process.env.SANDBOX_API_KEY || process.env.GST_API_KEY;

    if (!apiKey) {
        // Return helpful response indicating fallback state code detection
        return res.status(200).json({
            success: true,
            isMock: true,
            gstin: cleanGstin,
            stateCode: stateCodeDigits,
            state: estimatedState,
            message: 'API Key not configured. Returning estimated State from GSTIN code.'
        });
    }

    try {
        // Call Sandbox.co.in Public GSTIN endpoint
        const response = await fetch(`https://api.sandbox.co.in/gsp/public/gstin/${cleanGstin}`, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'x-api-version': '1.0',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok || data.code >= 400) {
            return res.status(response.status || 400).json({
                error: data.message || 'Failed to fetch GST details from Sandbox API',
                details: data
            });
        }

        const gData = data.data || data;
        const legalName = gData.lgnm || gData.legal_name || '';
        const tradeName = gData.tradeNam || gData.trade_name || legalName;
        const status = gData.sts || gData.status || 'Active';

        // Extract primary address
        const addrObj = gData.pradr?.addr || gData.principal_place_of_business?.address || {};
        let fullAddress = '';

        if (typeof addrObj === 'object') {
            const parts = [
                addrObj.bno || addrObj.building_number,
                addrObj.flno || addrObj.floor_number,
                addrObj.bnm || addrObj.building_name,
                addrObj.st || addrObj.street,
                addrObj.loc || addrObj.location,
                addrObj.dst || addrObj.district,
                addrObj.stcd || addrObj.state || estimatedState,
                addrObj.pncd || addrObj.pincode
            ].filter(Boolean);
            fullAddress = parts.join(', ');
        } else if (typeof addrObj === 'string') {
            fullAddress = addrObj;
        }

        return res.status(200).json({
            success: true,
            isMock: false,
            name: tradeName || legalName,
            legalName: legalName,
            tradeName: tradeName,
            gstin: cleanGstin,
            address: fullAddress,
            stateCode: stateCodeDigits,
            state: estimatedState,
            status: status,
            raw: gData
        });
    } catch (err) {
        return res.status(500).json({
            error: 'Server error querying Sandbox GST API: ' + err.message,
            stateCode: stateCodeDigits,
            state: estimatedState
        });
    }
}
