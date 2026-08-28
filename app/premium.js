import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Screen } from "../components/ui";
import { colors, radius, spacing, type } from "../lib/theme";
import { premiumService } from "../lib/services";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { MONETISATION_ENABLED } from "../lib/features";

const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: "₹99",
    note: "Billed every month",
  },
  {
    id: "yearly",
    label: "Yearly",
    price: "₹999",
    note: "Two months free",
  },
];

const PERKS = [
  "Play premium-only releases",
  "Ad-free listening",
  "Higher quality streaming",
  "Support Manipuri artists directly",
];

const Premium = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();

  // Cashfree returns the payer here via tantha://premium?order_id=…
  const params = useLocalSearchParams();

  const [plan, setPlan] = useState("monthly");
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  /**
   * Nothing links here while the app is free, but a deep link or a stale
   * navigation stack still could — and this screen starts a real payment.
   * Turn any such arrival straight back rather than take someone's money
   * for something that is not on sale.
   *
   * Every hook above runs unconditionally; the guard below is the only
   * branch, so hook order stays stable.
   */
  useEffect(() => {
    if (!MONETISATION_ENABLED) router.back();
  }, [router]);

  const startCheckout = async () => {
    setBusy(true);
    setError("");

    try {
      const res = await premiumService.subscribe(plan);
      setOrder(res);
    } catch (err) {
      setError(errorMessage(err, "Could not start checkout"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Returning from checkout, the order id is in the link rather than in
   * state — the payment happened outside the app, and this screen may have
   * been unmounted meanwhile. Verify it straight away so a payer is not
   * asked to press a button to claim what they already bought.
   */
  useEffect(() => {
    const returned = params.order_id || params.orderId;

    if (!returned || !MONETISATION_ENABLED) return;

    let cancelled = false;

    (async () => {
      setChecking(true);

      try {
        const res = await premiumService.verify(String(returned));

        if (cancelled) return;

        if (res?.success) {
          await refresh();
          router.replace("/(tabs)/profile");
          return;
        }

        setOrder({ orderId: String(returned) });
        setError(res?.message || "Payment not confirmed yet.");
      } catch (err) {
        if (!cancelled) {
          setOrder({ orderId: String(returned) });
          setError(errorMessage(err, "Could not verify the payment"));
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.order_id, params.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Confirms with the backend after the user completes payment. Separate from
   * checkout because the payment itself happens outside the app.
   */
  const confirmPayment = async () => {
    if (!order?.orderId) return;

    setChecking(true);
    setError("");

    try {
      const res = await premiumService.verify(order.orderId);

      if (res?.success) {
        await refresh();
        router.back();
        return;
      }

      setError(res?.message || "Payment not confirmed yet. Try again shortly.");
    } catch (err) {
      setError(errorMessage(err, "Could not verify the payment"));
    } finally {
      setChecking(false);
    }
  };

  if (!MONETISATION_ENABLED) return null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.xxl,
          paddingHorizontal: spacing.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>

        <Text style={styles.title}>Tantha Premium</Text>
        <Text style={[type.muted, { marginTop: spacing.sm }]}>
          Unlock everything and back the artists you love.
        </Text>

        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <Text style={styles.tick}>✓</Text>
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          {PLANS.map((option) => {
            const selected = plan === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => setPlan(option.id)}
                style={[styles.plan, selected && styles.planSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>{option.label}</Text>
                  <Text style={styles.planNote}>{option.note}</Text>
                </View>

                <Text style={[styles.planPrice, selected && { color: colors.accent }]}>
                  {option.price}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!order ? (
          <Button
            label="Continue to payment"
            onPress={startCheckout}
            loading={busy}
            style={{ marginTop: spacing.xl }}
          />
        ) : (
          <View style={styles.orderBox}>
            <Text style={styles.orderTitle}>Order created</Text>
            <Text style={styles.orderMeta}>
              {order.plan} · ₹{order.amount}
            </Text>
            <Text style={styles.orderId}>{order.orderId}</Text>

            {/*
              Cashfree takes the payment outside this screen. Wire their React
              Native SDK here with order.paymentSessionId to complete it in-app;
              until then this button re-checks the order with the backend.
            */}
            <Button
              label="I've paid — check status"
              onPress={confirmPayment}
              loading={checking}
              style={{ marginTop: spacing.lg }}
            />

            <Button
              label="Start over"
              variant="secondary"
              onPress={() => {
                setOrder(null);
                setError("");
              }}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  back: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.lg,
  },
  perks: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tick: {
    color: colors.accent,
    fontSize: 14,
  },
  perkText: {
    color: colors.text,
    fontSize: 14,
  },
  plans: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  planNote: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  error: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: 13,
  },
  orderBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  orderMeta: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  orderId: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.textFaint,
  },
});

export default Premium;
