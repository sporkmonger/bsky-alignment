export enum Outcome {
    Trusted,
    Accepted,
    Suspected,
    Restricted,
};

export class Decision {
    accept: number;
    restrict: number;
    unknown: number;

    constructor(accept: number, restrict: number, unknown: number) {
        this.accept = accept;
        this.restrict = restrict;
        this.unknown = unknown;
    }

    /// Reassigns unknown mass evenly to accept and restrict.
    ///
    /// This function is used to convert to a form that is useful in producing a final outcome.
    pignistic(): Decision {
        return new Decision(
            this.accept + this.unknown / 2.0,
            this.restrict + this.unknown / 2.0,
            0.0
        )
    }

    /// Checks the `restrict` value after `pignistic`
    /// transformation against several threshold values.
    ///
    /// The [`Outcome`]s are arranged in ascending order: `Trusted` < `Accepted` < `Suspected` < `Restricted`
    ///
    /// Does not take an `accept` threshold to simplify validation. Throws an error if threshold values are
    /// either out-of-order or out-of-range. Thresholds must be between 0.0 and 1.0.
    ///
    /// # Arguments
    ///
    /// * `trust` - The `trust` threshold is an upper-bound threshold. If the `restrict` value is below it, the
    ///     operation is `Trusted`.
    /// * `suspicious` - The `suspicious` threshold is a lower-bound threshold that also defines the accepted range.
    ///     If the `restrict` value is above the `trust` threshold and below the `suspicious` threshold, the operation
    ///     is `Accepted`. If the `restrict` value is above the `suspicious` threshold but below the `restrict`
    ///     threshold, the operation is `Suspected`.
    /// * `restrict` -  The `restricted` threshold is a lower-bound threshold. If the `restrict` value is above it,
    ///     the operation is `Restricted`.
    outcome(
        trust: number,
        suspicious: number,
        restrict: number,
    ): Outcome {
        let p = this.pignistic();
        if (trust > suspicious || suspicious > restrict) {
            throw "threshold out-of-order";
        }
        else if (trust <= 0.0 || trust >= 1.0) {
            throw "threshold out-of-range";
        }
        else if (suspicious <= 0.0 || suspicious >= 1.0) {
            throw "threshold out-of-range";
        }
        else if (restrict <= 0.0 || restrict >= 1.0) {
            throw "threshold out-of-range";
        }
        if (p.restrict <= trust) { return Outcome.Trusted }
        else if (p.restrict < suspicious) { return Outcome.Accepted }
        else if (p.restrict >= restrict) { return Outcome.Restricted }
        else { return Outcome.Suspected }
    }

    /// Clamps all values to the 0.0 to 1.0 range.
    ///
    /// Does not guarantee that values will sum to 1.0.
    clamp(): Decision {
        return this.clamp_min_unknown(0.0);
    }

    /// Clamps all values to the 0.0 to 1.0 range, guaranteeing that the unknown value will be at least `min`.
    ///
    /// Does not guarantee that values will sum to 1.0.
    ///
    /// # Arguments
    ///
    /// * `min` - The minimum [`unknown`] value.
    clamp_min_unknown(min: number): Decision {
        let accept = this.accept;
        let restrict = this.restrict;
        let unknown = this.unknown;

        if (accept < 0.0) {
            accept = 0.0;
        } else if (accept > 1.0) {
            accept = 1.0;
        }
        if (restrict < 0.0) {
            restrict = 0.0;
        } else if (restrict > 1.0) {
            restrict = 1.0;
        }
        if (unknown < 0.0) {
            unknown = 0.0;
        } else if (unknown > 1.0) {
            unknown = 1.0;
        }
        if (unknown < min) {
            unknown = min;
        }

        return new Decision(
            accept,
            restrict,
            unknown,
        );
    }

    /// If the component values sum to less than 1.0, assigns the remainder to the
    /// [`unknown`] value.
    fill_unknown(): Decision {
        let sum = this.accept + this.restrict + this.unknown;
        let unknown;
        if (sum < 1.0) {
            unknown = 1.0 - this.accept - this.restrict
        } else {
            unknown = this.unknown
        }
        return new Decision(
            this.accept,
            this.restrict,
            unknown,
        );
    }

    /// Rescales a [`Decision`] to ensure all component values are in the 0.0-1.0 range and sum to 1.0.
    ///
    /// It will preserve the relative relationship between `accept` and `restrict`.
    scale(): Decision {
        return this.scale_min_unknown(0.0);
    }

    /// Rescales a [`Decision`] to ensure all component values are in the 0.0-1.0 range and sum to 1.0 while
    /// ensuring that the `unknown` value is at least `min`.
    ///
    /// It will preserve the relative relationship between `accept` and `restrict`.
    ///
    /// # Arguments
    ///
    /// * `min` - The minimum `unknown` value.
    scale_min_unknown(min: number): Decision {
        let d = this.fill_unknown().clamp();
        let sum = d.accept + d.restrict + d.unknown;
        let accept = d.accept;
        let restrict = d.restrict;
        let unknown = d.unknown;

        if (sum > 0.0) {
            accept /= sum;
            restrict /= sum;
            unknown /= sum
        }
        if (unknown < min) {
            unknown = min
        }
        sum = 1.0 - unknown;
        if (sum > 0.0) {
            let denominator = accept + restrict;
            accept = sum * (accept / denominator);
            restrict = sum * (restrict / denominator)
        }
        return new Decision(
            accept,
            restrict,
            unknown,
        );
    }

    /// Multiplies the `accept` and `restrict` by the `factor`
    /// parameter, replacing the `unknown` value with the remainder.
    ///
    /// Weights below 1.0 will reduce the weight of a [`Decision`], while weights above 1.0 will increase it.
    /// A 1.0 weight has no effect on the result, aside from scaling it to a valid range if necessary.
    ///
    /// # Arguments
    ///
    /// * `factor` - A scale factor used to multiply the `accept` and `restrict` values.
    weight(factor: number): Decision {
        return new Decision(
            this.accept * factor,
            this.restrict * factor,
            0.0,
        ).scale();
    }

    /// Performs the conjunctive combination of two decisions.
    ///
    /// It is a helper function for [`combine_conjunctive`] and [`combine_murphy`].
    ///
    /// # Arguments
    ///
    /// * `left` - The first [`Decision`] of the pair.
    /// * `right` - The second [`Decision`] of the pair.
    static pairwise_combine(left: Decision, right: Decision): Decision {
        // The mass assigned to the null hypothesis due to non-intersection.
        let nullh = left.accept * right.restrict + left.restrict * right.accept;

        return new Decision(
            // These are essentially an unrolled loop over the power set.
            // Each focal element from the left is multiplied by each on the right
            // and then appended to the intersection.
            // Finally, each focal element is normalized with respect to whatever
            // was assigned to the null hypothesis.
            (left.accept * right.accept
                + left.accept * right.unknown
                + left.unknown * right.accept)
            / (1.0 - nullh),
            (left.restrict * right.restrict
                + left.restrict * right.unknown
                + left.unknown * right.restrict)
            / (1.0 - nullh),
            (left.unknown * right.unknown) / (1.0 - nullh),
        );
    }

    /// Calculates the conjunctive combination of a set of decisions, returning a new [`Decision`] as the result.
    ///
    /// Unlike `combine_murphy`, `combine_conjunctive` will produce a `NaN` result under
    /// high conflict.
    ///
    /// # Arguments
    ///
    /// * `decisions` - The `Decision`s to be combined.
    static combine_conjunctive(decisions: Array<Decision>) {
        let d = new Decision(0.0, 0.0, 1.0);
        for (var m of decisions) {
            d = Decision.pairwise_combine(d, m);
        }
        return d
    }

    /// Calculates the Murphy average of a set of decisions, returning a new [`Decision`] as the result.
    ///
    /// The Murphy average rule[^1] takes the mean value of each focal element across
    /// all mass functions to create a new mass function. This new mass function
    /// is then combined conjunctively with itself N times where N is the total
    /// number of functions that were averaged together.
    ///
    /// # Arguments
    ///
    /// * `decisions` - The `Decision`s to be combined.
    ///
    /// [^1]: Catherine K. Murphy. 2000. Combining belief functions when evidence conflicts.
    ///     Decision Support Systems 29, 1 (2000), 1-9. DOI:<https://doi.org/10.1016/s0167-9236(99)00084-6>
    static combine_murphy(decisions: Array<Decision>) {
        let sum_a = 0.0;
        let sum_d = 0.0;
        let sum_u = 0.0;
        let length = 0;
        for (var m of decisions) {
            sum_a += m.accept;
            sum_d += m.restrict;
            sum_u += m.unknown;
            length += 1;
        }
        let avg_d = new Decision(
            sum_a / length,
            sum_d / length,
            sum_u / length,
        );
        let d = new Decision(
            0.0,
            0.0,
            1.0,
        );
        for (let i = 0; i < length; i++) {
            d = Decision.pairwise_combine(d, avg_d);
        }
        return d;
    }
}
