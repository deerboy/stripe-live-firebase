import * as functions from "firebase-functions";
import Stripe from "stripe";

import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

const stripe = new Stripe(
  "sk_test_51Jdp8EAWtyvRAjLnBsjtPGgtx2NoPCvorNaKg3sus9tQh2LDKUgz31GQ59UxZotg80yarcsI7hIj0MAyje7IoSNX00LVkbLKSm",
  {
    apiVersion: "2020-08-27",
  }
);

export const createCustomer = functions
  .region("asia-northeast1")
  .auth.user()
  .onCreate(async (user) => {
    const customer = await stripe.customers.create({
      name: user.uid,
    });

    return db.doc(`users/${user.uid}`).set({
      createdAt: Date.now(),
      customerId: customer.id,
    });
  });

export const onStripeEvent = functions.https.onRequest(
  async (request, response) => {
    const sig = request.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig as any,
        "whsec_AqllTO9cSYnwEwyjcTKY2gJj6s8DngnV"
      );
    } catch (err) {
      functions.logger.error((err as any).message);
      response.status(400).send("Webhook Error");
      return;
    }

    const customer: any = event.data.object;
    let premium = false;

    switch (event.type) {
      case "customer.subscription.created":
        premium = true;
        break;
      case "customer.subscription.deleted":
        premium = false;
        break;
    }

    const docRef = (
      await db.collection("users").where("customerId", "==", customer.id).get()
    ).docs[0].ref;

    await docRef.update({
      premium,
    });

    response.status(200).send("success");
  }
);

export const getCheckoutURL = functions
  .region("asia-northeast1")
  .https.onCall(async ({ cid }) => {
    const priceId = "price_1JdpBFAWtyvRAjLnX7E6x7L4";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: cid,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/",
      cancel_url: "http://localhost:3000/",
    });

    return session.url;
  });
