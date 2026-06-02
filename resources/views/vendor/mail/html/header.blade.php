@props(['url'])
{{-- Property Basket email header — solid black bar, white house icon + wordmark. --}}
<tr>
<td class="header" style="background-color: #000000; padding: 22px 28px;">
<a href="{{ $url }}" style="display: block; text-decoration: none;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
<tr>
<td style="vertical-align: middle; padding-right: 14px;">
<img src="{{ asset('images/logo-icon-white.png') }}"
     alt=""
     width="32"
     height="32"
     style="display: block; border: 0; outline: none; text-decoration: none; height: 32px; width: 32px;">
</td>
<td style="vertical-align: middle;">
<span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; font-weight: 800; font-size: 20px; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1;">
PROPERTY BASKET
</span>
</td>
</tr>
</table>
</a>
</td>
</tr>
