import Stripe from "stripe";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

// Configuración de Stripe con la versión más reciente
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-04-10",
  });

// Permisos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: "No autorizado" }), { status: 401 });
    }

    const { carId, startDate, endDate } = await req.json();
    if (!carId || !startDate || !endDate) {
      return new NextResponse(JSON.stringify({ error: "Faltan datos requeridos" }), { status: 400 });
    }

    // El precio y el nombre salen de la base, no del cliente
    const car = await db.car.findUnique({ where: { id: carId } });
    if (!car || !car.isPublish) {
      return new NextResponse(JSON.stringify({ error: "Coche no disponible" }), { status: 404 });
    }
    const priceDay = Number(car.priceDay);
    const carName = car.name;

    // Convertir fechas
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return new NextResponse(JSON.stringify({ error: "Fechas inválidas" }), { status: 400 });
    }

    const totalAmount = priceDay * days;
    const totalAmountStripe = Math.round(totalAmount * 100); // Stripe usa céntimos

    // Crear orden en la base de datos
    const order = await db.order.create({
      data: {
        carId,
        carName,
        userId,
        status: "pending",
        totalAmount: totalAmount.toString(),
        orderDate: start,
        orderEndDate: end,
      },
    });

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "EUR",
            product_data: { name: carName, description: `Alquiler por ${days} días` },
            unit_amount: totalAmountStripe,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-error`,
      metadata: {
        orderId: order.id,
        carId,
        userId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days: days.toString(),
      },
    });

    return NextResponse.json({ url: session.url }, { headers: corsHeaders });

  } catch (error) {
    console.error("[CHECKOUT_ERROR]", error);
    return new NextResponse(JSON.stringify({ error: "Error al procesar el pago" }), { status: 500 });
  }
}
