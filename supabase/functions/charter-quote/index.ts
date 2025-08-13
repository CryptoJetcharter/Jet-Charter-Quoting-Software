// charter-quote/index.ts - Charter flight quote calculator
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Define request payload type
interface QuoteRequest {
  origin_id: number;
  destination_id: number;
  departure_date: string;
  return_date?: string;
  passengers: number;
  aircraft_type_id?: number;
  extras?: number[];
  promo_code?: string;
  subscription_tier: string;
}

// Constants
const EARTH_RADIUS_KM = 6371; // Earth radius in kilometers
const SUBSCRIPTION_DISCOUNTS = {
  "free": 0,
  "premium": 5,
  "business": 10,
  "elite": 15
};

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }
    
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const quoteRequest: QuoteRequest = await req.json();
    
    // Validate required fields
    if (!quoteRequest.origin_id || !quoteRequest.destination_id || 
        !quoteRequest.departure_date || !quoteRequest.passengers) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch origin and destination airports
    const { data: originAirport } = await supabase
      .from("charter.airports")
      .select("*")
      .eq("id", quoteRequest.origin_id)
      .single();

    const { data: destinationAirport } = await supabase
      .from("charter.airports")
      .select("*")
      .eq("id", quoteRequest.destination_id)
      .single();

    if (!originAirport || !destinationAirport) {
      return new Response(JSON.stringify({ error: "Airport not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate distance between airports (Haversine formula)
    const lat1 = originAirport.latitude * Math.PI / 180;
    const lat2 = destinationAirport.latitude * Math.PI / 180;
    const lon1 = originAirport.longitude * Math.PI / 180;
    const lon2 = destinationAirport.longitude * Math.PI / 180;
    
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = EARTH_RADIUS_KM * c;

    // Find suitable aircraft types based on distance and passengers
    let aircraftQuery = supabase
      .from("charter.aircraft_types")
      .select("*")
      .gte("range_km", distance)
      .gte("max_passengers", quoteRequest.passengers)
      .order("hourly_rate", { ascending: true });
    
    // If specific aircraft type requested, filter for it
    if (quoteRequest.aircraft_type_id) {
      aircraftQuery = supabase
        .from("charter.aircraft_types")
        .select("*")
        .eq("id", quoteRequest.aircraft_type_id)
        .single();
    }
    
    const { data: aircraft } = await aircraftQuery;
    
    // Check if aircraft is available
    if (!aircraft || (Array.isArray(aircraft) && aircraft.length === 0)) {
      return new Response(JSON.stringify({ 
        error: "No suitable aircraft found for this journey", 
        message: "Try reducing passenger count or selecting a different aircraft"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Select first aircraft if array returned
    const selectedAircraft = Array.isArray(aircraft) ? aircraft[0] : aircraft;
    
    // Calculate flight time
    const flightTimeHours = distance / selectedAircraft.cruise_speed_kmh;
    const hours = Math.floor(flightTimeHours);
    const minutes = Math.floor((flightTimeHours - hours) * 60);
    
    // Calculate base flight cost
    const flightCost = selectedAircraft.hourly_rate * (Math.ceil(flightTimeHours * 2) / 2);
    
    // Check for round trip
    const isRoundTrip = !!quoteRequest.return_date;
    const totalFlightCost = isRoundTrip ? flightCost * 2 : flightCost;
    
    // Calculate extras cost
    let extrasCost = 0;
    let selectedExtras = [];
    
    if (quoteRequest.extras && quoteRequest.extras.length > 0) {
      const { data: extras } = await supabase
        .from("charter.extras")
        .select("*")
        .in("id", quoteRequest.extras);
        
      if (extras) {
        selectedExtras = extras;
        extrasCost = extras.reduce((sum, extra) => sum + extra.price, 0);
      }
    }
    
    // Apply subscription discount
    const subscriptionDiscountPercentage = SUBSCRIPTION_DISCOUNTS[quoteRequest.subscription_tier as keyof typeof SUBSCRIPTION_DISCOUNTS] || 0;
    const subscriptionDiscountAmount = (totalFlightCost + extrasCost) * (subscriptionDiscountPercentage / 100);
    
    // Check promo code if provided
    let promoDiscount = 0;
    if (quoteRequest.promo_code) {
      const { data: promoCode } = await supabase
        .from("charter.promo_codes")
        .select("*")
        .eq("code", quoteRequest.promo_code)
        .eq("is_active", true)
        .gte("valid_until", new Date().toISOString())
        .gt("max_uses", 0)
        .single();
        
      if (promoCode) {
        if (promoCode.discount_type === "percentage") {
          promoDiscount = (totalFlightCost + extrasCost) * (promoCode.discount_value / 100);
        } else {
          promoDiscount = promoCode.discount_value;
        }
        
        // Update promo code usage count
        await supabase
          .from("charter.promo_codes")
          .update({ max_uses: promoCode.max_uses - 1 })
          .eq("id", promoCode.id);
      }
    }
    
    // Calculate subtotal
    const subtotal = totalFlightCost + extrasCost - subscriptionDiscountAmount - promoDiscount;
    
    // Calculate tax (assume 7.5% tax rate)
    const taxRate = 0.075;
    const taxes = subtotal * taxRate;
    
    // Calculate total
    const total = subtotal + taxes;
    
    // Create quote object
    const quote = {
      quote_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Valid for 24 hours
      flight_details: {
        origin_id: originAirport.id,
        origin: originAirport.iata_code,
        destination_id: destinationAirport.id,
        destination: destinationAirport.iata_code,
        distance_km: Math.round(distance),
        estimated_flight_time: {
          hours,
          minutes
        },
        departure_date: quoteRequest.departure_date,
        return_date: quoteRequest.return_date || null,
        is_round_trip: isRoundTrip,
        passengers: quoteRequest.passengers
      },
      aircraft: selectedAircraft,
      selected_extras: selectedExtras,
      pricing: {
        flight_cost: totalFlightCost,
        extras_cost: extrasCost,
        subscription_discount: {
          percentage: subscriptionDiscountPercentage,
          amount: subscriptionDiscountAmount
        },
        promo_discount: promoDiscount,
        subtotal,
        taxes,
        total
      },
      booking_link: `${supabaseUrl}/functions/v1/charter-booking?quote=${crypto.randomUUID()}`
    };
    
    // Store quote in database for reference
    const { error } = await supabase
      .from("charter.quotes")
      .insert({
        id: quote.quote_id,
        quote_data: quote,
        expires_at: quote.expires_at
      });
    
    if (error) {
      console.error("Error saving quote:", error);
    }
    
    // Return response
    return new Response(JSON.stringify(quote), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
    
  } catch (error) {
    // Handle errors
    console.error("Error processing request:", error);
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
