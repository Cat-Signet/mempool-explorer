import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Address, AddressTxSummary } from '../../interfaces/electrs.interface';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { Observable, Subscription, catchError, map, of, switchMap, zip } from 'rxjs';
import { PriceService } from '../../services/price.service';

@Component({
  selector: 'app-address-transactions-widget',
  templateUrl: './address-transactions-widget.component.html',
  styleUrls: ['./address-transactions-widget.component.scss'],
})
export class AddressTransactionsWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() address: string;
  @Input() addressInfo: Address;
  @Input() addressSummary$: Observable<AddressTxSummary[]> | null;
  @Input() isPubkey: boolean = false;
  
  currencySubscription: Subscription;
  currency: string;

  transactions$: Observable<any[]>;

  isLoading: boolean = true;
  error: any;

  constructor(
    public stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private priceService: PriceService,
  ) { }

  ngOnInit(): void {
    this.currencySubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
    });
    this.startAddressSubscription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.startAddressSubscription();
  }

  startAddressSubscription(): void {
    this.isLoading = true;
    if (!this.address || !this.addressInfo) {
      return;
    }
    this.transactions$ = (this.addressSummary$ || (this.isPubkey
      ? this.electrsApiService.getScriptHashSummary$((this.address.length === 66 ? '21' : '41') + this.address + 'ac')
      : this.electrsApiService.getAddressSummary$(this.address)).pipe(
      catchError(e => {
        this.error = `Failed to fetch address history: ${e?.status || ''} ${e?.statusText || 'unknown error'}`;
        return of(null);
      })
    )).pipe(
      map(summary => {
        return summary?.slice(0, 6);
      }),
      switchMap(txs => {
        return (zip(txs.map(tx => this.priceService.getBlockPrice$(tx.time, true, this.currency).pipe(
          map(price => {
            return {
              ...tx,
              price,
            };
          })
        ))));
      })
    );
  }

  ngOnDestroy(): void {
    this.currencySubscription.unsubscribe();
  }
}
