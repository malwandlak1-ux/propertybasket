<?php

namespace App\Services\Banking\H2H;

use App\Models\BankLink;

/** Builds the transport for a link. Bound in the container so tests can swap in a fake. */
class TransportFactory
{
    public function for(BankLink $link): Transport
    {
        return new SftpTransport($link);
    }
}
